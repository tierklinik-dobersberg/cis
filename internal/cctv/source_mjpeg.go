package cctv

import (
	"context"
	"fmt"
	"io/ioutil"
	"mime"
	"mime/multipart"
	"net/http"
	"net/textproto"
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
	ch, key, err := src.attach()
	if err != nil {
		return err
	}

	defer func() {
		src.l.Lock()
		defer src.l.Unlock()
		delete(src.handlers, key)
	}()

	b := "test-boundary"
	c.Writer.Header().Set("Content-Type", "multipart/x-mixed-replace;boundary="+b)

	// flush headers to make sure frames are transmitted in chunks.
	c.Writer.Flush()

	conn, _, err := c.Writer.Hijack()
	if err != nil {
		return fmt.Errorf("failed to hijack: %w", err)
	}
	defer conn.Close()

	if err := conn.SetWriteDeadline(time.Time{}); err != nil {
		return fmt.Errorf("failed to clear write deadline: %s", err)
	}

	client := utils.RealClientIP(c.Request)
	writer := multipart.NewWriter(conn)
	writer.SetBoundary(b)

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

	if parsed != "multipart/x-mixed-replace" {
		return fmt.Errorf("unsupported content type: %s", ct)
	}
	boundary := params["boundary"]
	if boundary == "" {
		return fmt.Errorf("missing boundary in content type: %s", err)
	}

	reader := multipart.NewReader(resp.Body, boundary)
	log := logger.From(context.Background())
	go func() {
		defer resp.Body.Close()
		defer func() {
			src.l.Lock()
			defer src.l.Unlock()
			src.running = false
			for _, ch := range src.handlers {
				close(ch)
			}
			src.handlers = make(map[string]chan []byte)
		}()

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
