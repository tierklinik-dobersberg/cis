package api

import (
	"encoding/base64"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/userhub/internal/identitydb"
	"github.com/tierklinik-dobersberg/userhub/pkg/models/v1alpha"
)

type Server struct {
	engine *gin.Engine
	db     identitydb.Database
}

// New returns a new API server.
func New(db identitydb.Database) (*Server, error) {
	srv := &Server{
		engine: gin.Default(),
		db:     db,
	}

	srv.engine.GET("api/verify", func(ctx *gin.Context) {
		if header := ctx.Request.Header.Get("Authorization"); header != "" {
			status, user := srv.verifyBasicAuth(header)

			ctx.Status(status)
			if user != nil && status == http.StatusOK {
				ctx.Header("Remote-User", user.Name)
				ctx.Header("Remote-User-FullName", user.Fullname)

				for _, mail := range user.Mail {
					ctx.Writer.Header().Add("Remote-User-Mail", mail)
				}

				for _, phone := range user.PhoneNumber {
					ctx.Writer.Header().Add("Remote-User-Phone", phone)
				}

				return
			}

			return
		}

		// TODO(ppacher): session cookie with JWT value
		ctx.Status(http.StatusForbidden)
	})

	return srv, nil
}

func (srv *Server) verifyBasicAuth(header string) (int, *v1alpha.User) {
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
	if db.Authenticate(ctx.Request.Context(), parts[0], parts[1]) {
		user, err := db.GetUser(ctx.Request.Context(), parts[0])
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
