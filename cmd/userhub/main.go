package main

import (
	"os"

	"github.com/gin-gonic/gin"
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/logger"
	"github.com/tierklinik-dobersberg/service/server"
	"github.com/tierklinik-dobersberg/service/service"
	"github.com/tierklinik-dobersberg/userhub/internal/api"
	"github.com/tierklinik-dobersberg/userhub/internal/app"
	"github.com/tierklinik-dobersberg/userhub/internal/identitydb"
	"github.com/tierklinik-dobersberg/userhub/internal/loader"
	"github.com/tierklinik-dobersberg/userhub/internal/permission"
	"github.com/tierklinik-dobersberg/userhub/internal/schema"
)

func main() {
	var cfg app.Config
	instance, err := service.Boot(service.Config{
		ConfigFileName: "userhub.conf",
		ConfigFileSpec: conf.FileSpec{
			"global":       schema.GlobalConfigSpec,
			"listener":     server.ListenerSpec,
			"userproperty": schema.UserSchemaExtension,
		},
		ConfigTarget: &cfg,
		RouteSetupFunc: func(grp gin.IRouter) error {
			apiGroup := grp.Group("/api/", app.ExtractSessionUser())
			{
				api.LoginEndpoint(apiGroup)
				api.VerifyEndpoint(apiGroup)
				api.ProfileEndpoint(apiGroup)
				api.AvatarEndpoint(apiGroup)
			}

			return nil
		},
	})
	if err != nil {
		logger.Errorf("failed to boot service: %s", err)
		os.Exit(1)
	}

	ldr := loader.New(instance.ConfigurationDirectory)

	db, err := identitydb.New(ldr, cfg.UserProperties)
	if err != nil {
		logger.Errorf("failed to prepare database: %s", err)
		os.Exit(1)
	}

	matcher := permission.NewMatcher(permission.NewResolver(db))

	// Create a new application context and make sure it's added
	// to each incoming HTTP Request.
	appCtx := app.NewApp(&cfg, ldr, matcher, db)
	instance.Server().WithPreHandler(app.AddToRequest(appCtx))

	// run the server.
	if err := instance.Serve(); err != nil {
		logger.Errorf("failed to serve: %s", err)
		os.Exit(1)
	}
}
