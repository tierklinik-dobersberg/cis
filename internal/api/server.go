package api

import (
	"context"
	"encoding/base64"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/logger"
	"github.com/tierklinik-dobersberg/userhub/internal/identitydb"
	"github.com/tierklinik-dobersberg/userhub/internal/loader"
	"github.com/tierklinik-dobersberg/userhub/pkg/models/v1alpha"
)

// Server provides the API access to the userhub.
type Server struct {
	engine *gin.Engine
	db     identitydb.Database
	cfg    *loader.Config
}

// New returns a new API server.
func New(cfg *loader.Config, db identitydb.Database) (*Server, error) {
	srv := &Server{
		engine: gin.Default(),
		db:     db,
		cfg:    cfg,
	}

	srv.engine.GET("api/verify", func(ctx *gin.Context) {
		var status int = http.StatusForbidden
		var user *v1alpha.User

		username, sessionExpiry := srv.checkSessionCookie(ctx.Request)
		if username != "" {
			status = http.StatusOK

			u, err := srv.db.GetUser(ctx.Request.Context(), username)
			if err != nil {
				logger.From(ctx.Request.Context()).Infof("valid session for deleted user %s", user)
				sessionExpiry = 0
				status = http.StatusForbidden
			} else {
				user = &u
			}
		} else if header := ctx.Request.Header.Get("Authorization"); header != "" {
			status, user = srv.verifyBasicAuth(ctx.Request.Context(), header)
			sessionExpiry = 0
		}

		if user != nil && status == http.StatusOK {
			ctx.Header("Remote-User", user.Name)
			ctx.Header("Remote-User-FullName", user.Fullname)

			for _, mail := range user.Mail {
				ctx.Writer.Header().Add("Remote-User-Mail", mail)
			}

			for _, phone := range user.PhoneNumber {
				ctx.Writer.Header().Add("Remote-User-Phone", phone)
			}

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
	if !strings.HasPrefix(header, "Basic ") {
		return http.StatusBadRequest, nil
	}

	blob, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(header, "Basic "))
	if err != nil {
		return http.StatusBadRequest, nil
	}

	parts := strings.SplitN(string(blob), ":", 2)
	if len(parts) != 2 {
		return http.StatusBadRequest, nil
	}
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
