package main

import (
	"context"
	"net/http"
	"os"

	"github.com/ory/graceful"
	"github.com/tierklinik-dobersberg/logger"
	"github.com/tierklinik-dobersberg/userhub/internal/api"
	"github.com/tierklinik-dobersberg/userhub/internal/identitydb"
	"github.com/tierklinik-dobersberg/userhub/internal/loader"
	"github.com/tierklinik-dobersberg/userhub/internal/schema"
	"github.com/tierklinik-dobersberg/userhub/internal/server"
	"github.com/tierklinik-dobersberg/userhub/internal/serviceenv"
	"golang.org/x/sync/errgroup"
)

func main() {
	// We log to stdout and let systemd handle the rest.
	logger.SetDefaultAdapter(new(logger.StdlibAdapter))

	log := logger.DefaultLogger()

	env := serviceenv.Env()

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

	srv, err := server.New(cfg, ldr, db)
	if err != nil {
		log.Errorf("failed to prepare server: %s", err)
		os.Exit(1)
	}

	apiGroup := srv.Group("/api")
	{
		api.LoginEndpoint(srv, apiGroup)
		api.VerifyEndpoint(srv, apiGroup)
		api.ProfileEndpoint(srv, apiGroup)
		api.AvatarEndpoint(srv, apiGroup)
	}

	var starter []graceful.StartFunc
	var stopper []graceful.ShutdownFunc

	for _, listen := range cfg.Listeners {
		start, stop := prepareListener(listen, srv)
		starter = append(starter, start)
		stopper = append(stopper, stop)
	}

	start := func() error {
		for _, fn := range starter {
			if err := fn(); err != nil {
				return err
			}
		}

		return nil
	}

	stop := func(ctx context.Context) error {
		log.Infof("Shutting down ...")
		grp := new(errgroup.Group)

		for _, fn := range stopper {
			grp.Go(func() error {
				return fn(ctx)
			})
		}

		return grp.Wait()
	}

	if err := graceful.Graceful(start, stop); err != nil {
		log.Errorf("failed to stop server: %s", err)
		os.Exit(1)
	}

	log.Infof("Shutdown complete, good bye")
}

func prepareListener(listener schema.Listener, handler http.Handler) (graceful.StartFunc, graceful.ShutdownFunc) {
	server := graceful.WithDefaults(&http.Server{
		Addr:    listener.Address,
		Handler: handler,
	})

	startFunc := server.ListenAndServe

	if listener.TLSCertFile != "" && listener.TLSKeyFile != "" {
		startFunc = func() error {
			return server.ListenAndServeTLS(listener.TLSCertFile, listener.TLSKeyFile)
		}
	}

	return startFunc, server.Shutdown
}
