package api

import (
	"context"
	"encoding/base64"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/logger"
	"github.com/tierklinik-dobersberg/userhub/internal/accesslog"
	"github.com/tierklinik-dobersberg/userhub/internal/identitydb"
	"github.com/tierklinik-dobersberg/userhub/internal/loader"
	"github.com/tierklinik-dobersberg/userhub/pkg/models/v1alpha"
)

// Server provides the API access to the userhub.
type Server struct {
	engine *gin.Engine
	cfg    *loader.Config

	db identitydb.Database
}

// New returns a new API server.
func New(cfg *loader.Config, db identitydb.Database) (*Server, error) {
	srv := &Server{
		engine: gin.Default(),
		db:     db,
		cfg:    cfg,
	}

	srv.engine.Use(srv.logUser())
	srv.engine.Use(accessLogger(cfg))

	srv.engine.GET("api/verify", func(ctx *gin.Context) {
		var status int = http.StatusForbidden
		var user *v1alpha.User

		username, sessionExpiry := srv.checkSessionCookie(ctx.Request)
		if username != "" {
			status = http.StatusOK

			// try to get the user from the database, if that fails
			// the auth-request fails as well.
			u, err := srv.db.GetUser(ctx.Request.Context(), username)
			if err != nil {
				logger.From(ctx.Request.Context()).Infof("valid session for deleted user %s", user)
				sessionExpiry = 0
				status = http.StatusForbidden
			} else {
				user = &u
			}
		} else if header := ctx.Request.Header.Get("Authorization"); header != "" {
			// There's no session cookie available, check if the user
			// is trying basic-auth.
			status, user = srv.verifyBasicAuth(ctx.Request.Context(), header)
			sessionExpiry = 0
		}

		// on success, add user details as headers and
		// make sure there's a valid session cookie.
		if user != nil && status == http.StatusOK {
			addRemoteUserHeaders(*user, ctx.Writer)

			// make sure we have a sessions that valid and if it's going to
			// expire soon renew it now.
			if sessionExpiry < time.Minute*5 {
				cookie := srv.createSessionCookie(
					user.Name,
					time.Hour,
					!cfg.InsecureCookies,
				)
				http.SetCookie(ctx.Writer, cookie)
			}

			ctx.Status(status)

			return
		}

		http.SetCookie(
			ctx.Writer,
			srv.clearSessionCookie(),
		)
		ctx.Status(status)
	})

	return srv, nil
}

func (srv *Server) verifyBasicAuth(ctx context.Context, header string) (int, *v1alpha.User) {
	// We only support "Basic" auth so error out immediately for any
	// other technique.
	if !strings.HasPrefix(header, "Basic ") {
		return http.StatusBadRequest, nil
	}

	// get the base64 encoded user:password string
	blob, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(header, "Basic "))
	if err != nil {
		return http.StatusBadRequest, nil
	}

	// split user and passwort apart
	parts := strings.SplitN(string(blob), ":", 2)
	if len(parts) != 2 {
		return http.StatusBadRequest, nil
	}

	// and finally try to authenticate the user.
	if srv.db.Authenticate(ctx, parts[0], parts[1]) {
		user, err := srv.db.GetUser(ctx, parts[0])
		if err != nil {
			return http.StatusBadRequest, nil
		}

		return http.StatusOK, &user
	}
	return http.StatusForbidden, nil
}

// ServeHTTP implements http.Handler
func (srv *Server) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	srv.engine.ServeHTTP(w, req)
}

func accessLogger(cfg *loader.Config) gin.HandlerFunc {
	accessLogger := logger.DefaultLogger()
	if cfg.AccessLogFile != "" {
		adapter := logger.MultiAdapter(
			logger.DefaultAdapter(),
			&accesslog.FileWriter{
				Path:         cfg.AccessLogFile,
				ErrorAdapter: logger.DefaultAdapter(),
			},
		)
		accessLogger = logger.New(adapter)
	}

	return accesslog.New(accessLogger)
}

func addRemoteUserHeaders(u v1alpha.User, w http.ResponseWriter) {
	w.Header().Set("Remote-User", u.Name)
	w.Header().Set("Remote-FullName", u.Fullname)

	for _, mail := range u.Mail {
		w.Header().Add("Remote-Mail", mail)
	}

	for _, phone := range u.PhoneNumber {
		w.Header().Add("Remote-Phone", phone)
	}

	for _, group := range u.GroupNames {
		w.Header().Add("Remote-Group", group)
	}
}
