package server

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/logger"
	"github.com/tierklinik-dobersberg/userhub/internal/accesslog"
	"github.com/tierklinik-dobersberg/userhub/internal/identitydb"
	"github.com/tierklinik-dobersberg/userhub/internal/loader"
	"github.com/tierklinik-dobersberg/userhub/internal/permission"
)

// Server provides the API access to the userhub.
type Server struct {
	*gin.Engine

	Config  *loader.Config
	Loader  *loader.Loader
	Matcher *permission.Matcher
	DB      identitydb.Database
}

// New returns a new API server.
func New(cfg *loader.Config, ldr *loader.Loader, db identitydb.Database) (*Server, error) {
	srv := &Server{
		Engine:  gin.Default(),
		DB:      db,
		Loader:  ldr,
		Matcher: permission.NewMatcher(permission.NewResolver(db)),
		Config:  cfg,
	}

	srv.Engine.Use(srv.logUser())
	srv.Engine.Use(accessLogger(cfg))

	grp := srv.Engine.Group("api/profile", srv.requireUser())
	{
		grp.GET("", srv.profileEndpoint)
	}

	srv.Engine.GET("api/avatar/:userName", srv.requireUser(), srv.avatarEndpoint)

	return srv, nil
}

// ServeHTTP implements http.Handler
func (srv *Server) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	srv.Engine.ServeHTTP(w, req)
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
