package api

import (
	"encoding/base64"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/userhub/internal/identitydb"
)

type Server struct {
	engine *gin.Engine
}

// New returns a new API server.
func New(db identitydb.Database) (*Server, error) {
	srv := &Server{
		engine: gin.Default(),
	}

	srv.engine.GET("api/verify", func(ctx *gin.Context) {
		header := ctx.Request.Header.Get("Authorization")
		if header == "" {
			ctx.Status(http.StatusForbidden)
			return
		}

		if !strings.HasPrefix(header, "Basic ") {
			ctx.Status(http.StatusBadRequest)
			return
		}

		blob, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(header, "Basic "))
		if err != nil {
			ctx.Status(http.StatusBadRequest)
			return
		}

		parts := strings.SplitN(string(blob), ":", 2)
		if len(parts) != 2 {
			ctx.Status(http.StatusBadRequest)
			return
		}

		if db.Authenticate(ctx.Request.Context(), parts[0], parts[1]) {
			user, err := db.GetUser(ctx.Request.Context(), parts[0])
			if err != nil {
				ctx.Status(http.StatusBadRequest)
				return
			}

			ctx.Status(http.StatusOK)
			ctx.Header("Remote-User", user.Name)
			ctx.Header("Remote-User-Fullname", user.Fullname)

			for _, mail := range user.Mail {
				ctx.Writer.Header().Add("Remote-User-Mail", mail)
			}

			for _, phone := range user.PhoneNumber {
				ctx.Writer.Header().Add("Remote-User-Phone", phone)
			}

			return
		}

		ctx.Status(http.StatusForbidden)
	})

	return srv, nil
}

// ServeHTTP implements http.Handler
func (srv *Server) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	srv.engine.ServeHTTP(w, req)
}
