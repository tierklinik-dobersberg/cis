package tmpl2pdf

import (
	"context"
	"crypto/tls"
	"fmt"
	"html/template"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/labstack/echo/v4"
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/utils"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/pkg/svcenv"
	"github.com/tierklinik-dobersberg/cis/runtime"
	"github.com/tierklinik-dobersberg/logger"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
)

// TODO(ppacher):
//		- add support for basic assets serving
// 		- add support for queing of requests and limiting concurrency

type RenderRequest struct {
	Template string
	Vars     interface{}
}

type Creator struct {
	lock   sync.RWMutex
	schema *runtime.ConfigSchema

	BaseURL string

	configLock sync.Mutex
	config     *Config

	requests map[string]RenderRequest
}

func NewCreator(ctx context.Context, baseURL string, cs *runtime.ConfigSchema) (*Creator, error) {
	creator := &Creator{
		schema:   cs,
		BaseURL:  baseURL,
		config:   nil,
		requests: make(map[string]RenderRequest),
	}

	if err := creator.AddToSchema(cs); err != nil {
		return nil, err
	}

	var cfgs []Config

	if err := cs.DecodeSection(ctx, "tmpl2pdf", &cfgs); err != nil {
		return creator, err
	}

	if len(cfgs) == 1 {
		creator.config = &(cfgs[0])
	}

	return creator, nil
}

func (creator *Creator) SetupAPI(grp *echo.Group) {
	grp.GET("v1/:token", creator.serveRequest)
}

func (creator *Creator) serveRequest(c echo.Context) error {
	token := c.Param("token")

	var (
		req RenderRequest
		ok  bool
	)

	creator.lock.Lock()
	req, ok = creator.requests[token]
	creator.lock.Unlock()

	if !ok {
		return httperr.NotFound("render request", token)
	}

	tmpl, err := template.New(token).Parse(req.Template)
	if err != nil {
		return httperr.InternalError(err.Error())
	}

	buf := new(strings.Builder)
	if err := tmpl.Execute(buf, req.Vars); err != nil {
		return httperr.InternalError(err.Error())
	}

	return c.HTML(http.StatusOK, buf.String())
}

func (creator *Creator) Render(ctx context.Context, req RenderRequest) (string, error) {
	var cfg *Config

	ctx, span := otel.Tracer("").Start(ctx, "tmpl2pdf.Creator#Render")
	defer span.End()

	creator.lock.Lock()
	cfg = creator.config
	creator.lock.Unlock()

	if cfg == nil {
		return "", httperr.InternalError(
			fmt.Errorf("pdf generation support is disabled. Please configure it first"),
		)
	}

	token, err := utils.Nonce(64)
	if err != nil {
		return "", err
	}

	creator.lock.Lock()
	if creator.requests == nil {
		creator.requests = make(map[string]RenderRequest)
	}
	creator.requests[token] = req
	creator.lock.Unlock()

	name, err := utils.Nonce(16)
	if err != nil {
		return "", fmt.Errorf("failed to generate name: %w", err)
	}

	baseURL := creator.BaseURL
	if !strings.HasSuffix(baseURL, "/") {
		baseURL += "/"
	}

	url := fmt.Sprintf("%sapi/_sys/pdf/v1/%s", baseURL, token)
	targetFileDir := filepath.Join(
		svcenv.Env().StateDirectory,
		"pdf-generation",
	)
	if err := os.MkdirAll(targetFileDir, 0700); err != nil {
		return "", fmt.Errorf("failed to create target directory: %w", err)
	}

	targetFilePath := filepath.Join(
		targetFileDir,
		name+".pdf",
	)

	span.SetAttributes(
		attribute.String("render_url", url),
		attribute.String("output_file", targetFilePath),
	)

	targetFile, err := os.Create(targetFilePath)
	if err != nil {
		return "", fmt.Errorf("failed to create output file: %w", err)
	}
	defer targetFile.Close()

	reader, err := ConvertURLToPDF(ctx, creator.getClient(), creator.config.Server, url)
	if err != nil {
		return "", err
	}

	if _, err := io.Copy(targetFile, reader); err != nil {
		return "", fmt.Errorf("failed to copy content: %w", err)
	}

	return targetFilePath, nil
}

func (creator *Creator) LoadConfig(ctx context.Context) {
	var cfg []Config
	if err := creator.schema.DecodeSection(ctx, "tmpl2pdf", &cfg); err != nil {
		logger.From(ctx).Errorf("failed to load tmpl2html configuration: %s", err)

		return
	}
}

func (creator *Creator) NotifyChange(ctx context.Context, changeType, id string, sec *conf.Section) error {
	creator.configLock.Lock()
	defer creator.configLock.Unlock()

	creator.config = nil

	if changeType != "delete" {
		var cfg Config
		if err := conf.DecodeSections([]conf.Section{*sec}, Spec, &cfg); err != nil {
			return err
		}

		creator.config = &cfg
	}

	return nil
}

func (creator *Creator) getClient() *http.Client {
	cli := new(http.Client)

	creator.lock.Lock()
	defer creator.lock.Unlock()

	if creator.config != nil && creator.config.AllowInsecure {
		cli.Transport = &http.Transport{
			TLSClientConfig: &tls.Config{
				// trunk-ignore(golangci-lint/gosec)
				InsecureSkipVerify: creator.config.AllowInsecure,
			},
		}
	}

	return cli
}
