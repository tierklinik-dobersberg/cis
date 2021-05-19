package cctv

import (
	"context"
	"fmt"
	"io/ioutil"
	"mime"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	uuid "github.com/kevinburke/go.uuid"
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/logger"
	"github.com/tierklinik-dobersberg/service/utils"
)

// MJPEGSource describes how to access an MJPEG stream of the camera.
type MJPEGSource struct {
	// URL is the address of the MJPEG
	// stream.
	URL string

	handlers map[string]chan []byte
	running  bool
	l        sync.Mutex
}

// MJPEGSourceSpec defines the section spec for MJPEGSource.
var MJPEGSourceSpec = conf.SectionSpec{
	{
		Name:        "URL",
		Type:        conf.StringType,
		Description: "The URL to access the MJPEG stream of the camera.",
		Required:    true,
	},
}

// Attach implements Source.Attach.
func (src *MJPEGSource) Attach(ctx context.Context, c *gin.Context) error {
	// start pulling frames and send them to ch.
	ch, key, err := src.attach()
	if err != nil {
		return err
	}

	// remove our ch from handlers once we're done
	defer func() {
		src.l.Lock()
		defer src.l.Unlock()
		delete(src.handlers, key)
	}()

	// hijack the connection as we need to clear
	// read/write timeouts.
	conn, _, err := c.Writer.Hijack()
	if err != nil {
		return fmt.Errorf("failed to hijack: %w", err)
	}
	defer conn.Close()

	// perpare a multipart writer and the HTTP response
	// header
	client := utils.RealClientIP(c.Request)
	writer := multipart.NewWriter(conn)
	res := http.Response{
		StatusCode:    http.StatusOK,
		ProtoMajor:    c.Request.ProtoMajor,
		ProtoMinor:    c.Request.ProtoMinor,
		ContentLength: -1, // unknown
		Header:        http.Header{},
	}

	// We must quote the boundary if it contains any of the
	// specials characters defined by RFC 2045, or space.
	b := writer.Boundary()
	if strings.ContainsAny(b, `()<>@,;:\"/[]?= `) {
		b = `"` + b + `"`
	}
	res.Header.Set("Content-Type", "multipart/x-mixed-replace;boundary="+b)

	// write the headers to the client
	if err := res.Write(conn); err != nil {
		return fmt.Errorf("failed to write response header: %w", err)
	}

	// clear any write and read-dealines
	if err := conn.SetReadDeadline(time.Time{}); err != nil {
		return fmt.Errorf("failed to clear read deadline: %w", err)
	}
	if err := conn.SetWriteDeadline(time.Time{}); err != nil {
		return fmt.Errorf("failed to clear write deadline: %w", err)
	}

	// forward JPEG frames
	for msg := range ch {
		header := textproto.MIMEHeader{}
		header.Set("content-type", "image/jpeg")
		header.Set("content-length", fmt.Sprintf("%d", len(msg)))

		part, err := writer.CreatePart(header)
		if err != nil {
			logger.From(ctx).Errorf("failed to create part for %s: %s", client.String(), err)
			return err
		}

		if err := conn.SetWriteDeadline(time.Now().Add(time.Second)); err != nil {
			logger.From(ctx).Errorf("failed to set write deadline to %s: %s", client.String(), err)
			return err
		}

		if _, err := part.Write(msg); err != nil {
			logger.From(ctx).Errorf("failed to write part to %s: %s", client.String(), err)
			return err
		}
	}

	if err := writer.Close(); err != nil {
		logger.From(ctx).Errorf("failed to close mutlipart writer: %s", err)
	}

	return nil
}

func (src *MJPEGSource) attach() (chan []byte, string, error) {
	src.l.Lock()
	defer src.l.Unlock()

	if src.handlers == nil {
		src.handlers = make(map[string]chan []byte)
	}

	ch := make(chan []byte)
	key := uuid.NewV4().String()

	src.handlers[key] = ch

	if !src.running {
		if err := src.pull(); err != nil {
			close(ch)
			return ch, key, err
		}
	}
	return ch, key, nil
}

func (src *MJPEGSource) pull() error {
	resp, err := http.Get(src.URL)
	if err != nil {
		return err
	}

	ct := resp.Header.Get("content-type")
	parsed, params, err := mime.ParseMediaType(ct)
	if err != nil {
		return err
	}

	// we currently only support MJPEG streams that use multipart
	// streaming with x-mixed-replace. Better make sure this is
	// really a supported cam.
	if parsed != "multipart/x-mixed-replace" {
		return fmt.Errorf("unsupported content type: %s", ct)
	}

	// get a new multipart reader from the returned body
	// and start pulling frames.
	boundary := params["boundary"]
	if boundary == "" {
		return fmt.Errorf("missing boundary in content type: %s", err)
	}
	reader := multipart.NewReader(resp.Body, boundary)
	src.running = true

	log := logger.From(context.Background())
	go func() {
		defer func() {
			src.l.Lock()
			defer src.l.Unlock()

			// close all handler channels which will wake-up
			// the pumps and close the streaming connections.
			src.running = false
			for _, ch := range src.handlers {
				close(ch)
			}
			src.handlers = make(map[string]chan []byte)
		}()
		defer resp.Body.Close()

		for {
			part, err := reader.NextPart()
			if err != nil {
				log.Errorf("failed to read part form camera: %s", err)
				return
			}

			pct := part.Header.Get("content-type")
			parsed, _, err = mime.ParseMediaType(pct)
			if err != nil {
				log.Errorf("cannot parse content type of multipart: %s", pct)
				return
			}
			if parsed != "image/jpeg" {
				log.Errorf("unsupported content type of multipart: %s", err)
				return
			}

			frame, err := ioutil.ReadAll(part)
			if err != nil {
				log.Errorf("failed to read JPEG frame: %s", err)
				return
			}

			src.l.Lock()
			refcount := len(src.handlers)
			for _, ch := range src.handlers {
				select {
				case ch <- frame:
				default:
					log.Infof("failed to forward frame")
				}
			}
			src.l.Unlock()
			if refcount == 0 {
				log.Infof("no stream subscribers. Aborting ...")
				break
			}
		}
	}()

	return nil
}
