package main

import (
	"os"

	"github.com/ory/graceful"
	"github.com/tierklinik-dobersberg/logger"
	"github.com/tierklinik-dobersberg/service/server"
	"github.com/tierklinik-dobersberg/service/svcenv"
	"github.com/tierklinik-dobersberg/userhub/internal/api"
	"github.com/tierklinik-dobersberg/userhub/internal/app"
	"github.com/tierklinik-dobersberg/userhub/internal/identitydb"
	"github.com/tierklinik-dobersberg/userhub/internal/loader"
	"github.com/tierklinik-dobersberg/userhub/internal/permission"
)

func main() {
	// We log to stdout and let systemd handle the rest.
	logger.SetDefaultAdapter(new(logger.StdlibAdapter))

	log := logger.DefaultLogger()

	env := svcenv.Env()

	log.WithFields(logger.Fields{
		"ConfigurationDirectory": env.ConfigurationDirectory,
		"StateDirectory":         env.StateDirectory,
		"RuntimeDirectory":       env.RuntimeDirectory,
	}).Info("Service Environment")

	ldr := loader.New(env.ConfigurationDirectory)

	cfg, err := ldr.LoadGlobalConfig()
	if err != nil {
		log.Errorf("failec to load global confug: %s", err)
		os.Exit(1)
	}

	db, err := identitydb.New(ldr, cfg.UserProperties)
	if err != nil {
		log.Errorf("failed to prepare database: %s", err)
		os.Exit(1)
	}

	matcher := permission.NewMatcher(permission.NewResolver(db))

	appCtx := app.NewApp(cfg, ldr, matcher, db)

	srv, err := server.New(
		cfg.AccessLogFile,
		cfg.Listeners,
		app.ServerOption(appCtx),
	)
	if err != nil {
		log.Errorf("failed to prepare server: %s", err)
		os.Exit(1)
	}

	apiGroup := srv.Group("/api/")
	{
		api.LoginEndpoint(apiGroup)
		api.VerifyEndpoint(apiGroup)
		api.ProfileEndpoint(apiGroup)
		api.AvatarEndpoint(apiGroup)
	}

	if err := graceful.Graceful(srv.Run, srv.Shutdown); err != nil {
		log.Errorf("Failed to start/stop http server: %s", err)
		return
	}

	log.Infof("Shutdown complete, good bye")
}
