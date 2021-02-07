package app

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/database/calllogdb"
	"github.com/tierklinik-dobersberg/cis/internal/database/commentdb"
	"github.com/tierklinik-dobersberg/cis/internal/database/customerdb"
	"github.com/tierklinik-dobersberg/cis/internal/database/identitydb"
	"github.com/tierklinik-dobersberg/cis/internal/database/rosterdb"
	"github.com/tierklinik-dobersberg/cis/internal/database/voicemaildb"
	"github.com/tierklinik-dobersberg/cis/internal/mailsync"
	"github.com/tierklinik-dobersberg/cis/internal/openinghours"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/logger"
	"github.com/tierklinik-dobersberg/service/server"
	"github.com/tierklinik-dobersberg/service/service"
)

type contextKey string

const appContextKey = contextKey("app:context")

// App holds dependencies for cis API request handlers.
type App struct {
	Instance    *service.Instance
	Config      *Config
	Matcher     *permission.Matcher
	DutyRosters rosterdb.Database
	Identities  identitydb.Database
	Customers   customerdb.Database
	Comments    commentdb.Database
	VoiceMails  voicemaildb.Database
	MailSync    *mailsync.Manager
	Door        *openinghours.DoorController
	Holidays    openinghours.HolidayGetter
	CallLogs    calllogdb.Database
}

func (app *App) String() string {
	return "app.App"
}

// NewApp context creates a new application context.
func NewApp(
	inst *service.Instance,
	cfg *Config,
	matcher *permission.Matcher,
	identities identitydb.Database,
	customers customerdb.Database,
	dutyRosters rosterdb.Database,
	comments commentdb.Database,
	voicemail voicemaildb.Database,
	manager *mailsync.Manager,
	door *openinghours.DoorController,
	holidays openinghours.HolidayGetter,
	calllogs calllogdb.Database) *App {
	return &App{
		Instance:    inst,
		Config:      cfg,
		Matcher:     matcher,
		Identities:  identities,
		Customers:   customers,
		DutyRosters: dutyRosters,
		Comments:    comments,
		VoiceMails:  voicemail,
		MailSync:    manager,
		Door:        door,
		Holidays:    holidays,
		CallLogs:    calllogs,
	}
}

// With adds app to ctx.
func With(ctx context.Context, app *App) context.Context {
	return context.WithValue(ctx, appContextKey, app)
}

// ServerOption returns a server option that adds app to
// each request. Useful if used together with From() in
// request handlers.
func ServerOption(app *App) server.Option {
	return server.WithPreHandler(AddToRequest(app))
}

// AddToRequest returns a (service/server).PreHandlerFunc that
// adds app to each incoming HTTP request.
func AddToRequest(app *App) server.PreHandlerFunc {
	return func(req *http.Request) *http.Request {
		ctx := req.Context()

		return req.WithContext(
			With(ctx, app),
		)
	}
}

// From returns the App associated with c.
// If there is no context assigned to c the request
// is terminated with 500 Internal Server error.
func From(c *gin.Context) *App {
	val, _ := c.Request.Context().Value(appContextKey).(*App)

	if val == nil {
		server.AbortRequest(c, http.StatusInternalServerError, errors.New("No AppCtx available"))
		return nil
	}

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
		url = url + "/"
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
		path = path + "/"
	}
	return path
}

// EndpointPath returns the absolute path to the endpoint.
func (app *App) EndpointPath(relativePath string) string {
	return path.Join(app.BasePath(), relativePath)
}

// Location returns the location CIS is running at.
func (app *App) Location() *time.Location {
	loc, err := time.LoadLocation(app.Config.TimeZone)
	if err != nil {
		return time.UTC
	}

	return loc
}
