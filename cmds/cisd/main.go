package main

import (
	"context"

	"github.com/gin-gonic/gin"
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/api/identityapi"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/identitydb"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/internal/schema"
	"github.com/tierklinik-dobersberg/logger"
	"github.com/tierklinik-dobersberg/service/server"
	"github.com/tierklinik-dobersberg/service/service"
)

func main() {
	var cfg app.Config
	ctx := context.Background()

	instance, err := service.Boot(service.Config{
		ConfigFileName: "cis.conf",
		ConfigFileSpec: conf.FileSpec{
			"global":       schema.GlobalConfigSpec,
			"listener":     server.ListenerSpec,
			"userproperty": schema.UserSchemaExtension,
		},
		ConfigTarget: &cfg,
		RouteSetupFunc: func(grp gin.IRouter) error {
			apiGroup := grp.Group("/api/", app.ExtractSessionUser())
			{
				identityapi.LoginEndpoint(apiGroup)
				identityapi.VerifyEndpoint(apiGroup)
				identityapi.ProfileEndpoint(apiGroup)
				identityapi.AvatarEndpoint(apiGroup)
			}

			return nil
		},
	})
	if err != nil {
		logger.Fatalf(ctx, "failed to boot service: %s", err)
	}

	db, err := identitydb.New(ctx, instance.ConfigurationDirectory, cfg.UserProperties)
	if err != nil {
		logger.Fatalf(ctx, "failed to prepare database: %s", err)
	}

	matcher := permission.NewMatcher(permission.NewResolver(db))

	// Create a new application context and make sure it's added
	// to each incoming HTTP Request.
	appCtx := app.NewApp(&cfg, matcher, db)
	instance.Server().WithPreHandler(app.AddToRequest(appCtx))

	// run the server.
	if err := instance.Serve(); err != nil {
		logger.Fatalf(ctx, "failed to serve: %s", err)
	}
}
