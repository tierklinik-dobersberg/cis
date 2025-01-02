package app

import (
	"context"
	"fmt"
	"net/url"
	"path"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/door"
	"github.com/tierklinik-dobersberg/cis/internal/idm"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/logger"
)

type contextKey string

const appContextKey = contextKey("app:context")

// App holds dependencies for cis API request handlers.
type App struct {
	Config *Config
	IDM    *idm.Provider
	Door   *door.Controller

	RosterdServer string
}

func (app *App) String() string {
	return "app.App"
}

// NewApp context creates a new application context.
func NewApp(
	cfg *Config,
	door *door.Controller,
	RosterdServer string,
	idmProvider *idm.Provider,
) *App {
	return &App{
		Config:        cfg,
		Door:          door,
		RosterdServer: RosterdServer,
		IDM:           idmProvider,
	}
}

// With adds app to ctx.
func With(ctx context.Context, app *App) context.Context {
	return context.WithValue(ctx, appContextKey, app)
}

// From returns the App associated with c.
// If there is no context assigned to c the request
// is terminated with 500 Internal Server error.
func From(c echo.Context) (*App, error) {
	val := FromContext(c.Request().Context())

	if val == nil {
		return nil, httperr.InternalError().SetInternal(fmt.Errorf("no appCtx available"))
	}

	return val, nil
}

// FromContext returns the App associated with c.
func FromContext(ctx context.Context) *App {
	val, _ := ctx.Value(appContextKey).(*App)

	return val
}

// BaseURL returns the base URL if the application as configured in
// the BaseURL setting. If not configured the Host header of the HTTP
// request is used.
func (app *App) BaseURL(c *gin.Context) string {
	url := app.Config.BaseURL
	if url == "" {
		url = fmt.Sprintf("%s//%s/", c.Request.URL.Scheme, c.Request.Host)
	}

	if !strings.HasSuffix(url, "/") {
		url += "/"
	}

	return url
}

// BasePath returns the base path of the application.
func (app *App) BasePath() string {
	if app.Config.BaseURL == "" {
		return "/"
	}

	u, err := url.Parse(app.Config.BaseURL)
	if err != nil {
		logger.DefaultLogger().Errorf("failed to parse BaseURl setting: %s", err)

		return "/"
	}

	path := u.Path
	if !strings.HasSuffix(path, "/") {
		path += "/"
	}

	return path
}

// EndpointPath returns the absolute path to the endpoint.
func (app *App) EndpointPath(relativePath string) string {
	return path.Join(app.BasePath(), relativePath)
}

// Location returns the location CIS is running at.
// Deprecated: use Config.Location() instead.
func (app *App) Location() *time.Location {
	return app.Config.Location()
}

// ParseTime is like time.Parse but makes sure the returned time is put
// into the configured local timezone.
func (app *App) ParseTime(layout string, str string) (time.Time, error) {
	return time.ParseInLocation(layout, str, app.Location())
}
