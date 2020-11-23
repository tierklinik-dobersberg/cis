package main

import (
	"net/http"
	"os"

	"github.com/tierklinik-dobersberg/logger"
	"github.com/tierklinik-dobersberg/userhub/internal/api"
	"github.com/tierklinik-dobersberg/userhub/internal/identitydb"
	"github.com/tierklinik-dobersberg/userhub/internal/loader"
	"github.com/tierklinik-dobersberg/userhub/internal/serviceenv"
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

	db, err := identitydb.New(ldr)
	if err != nil {
		log.Errorf("failed to prepare database: %s", err)
		os.Exit(1)
	}

	srv, err := api.New(db)
	if err != nil {
		log.Errorf("failed to prepare server: %s", err)
		os.Exit(1)
	}

	http.ListenAndServe(":3000", srv)
}
