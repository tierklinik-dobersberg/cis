package main

import (
	"context"

	"github.com/gin-gonic/gin"
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/api/customerapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/identityapi"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/database/customerdb"
	"github.com/tierklinik-dobersberg/cis/internal/database/identitydb"
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
			"global":       schema.ConfigSpec,
			"database":     schema.DatabaseSpec,
			"vetinf":       schema.VetInfSpec,
			"identity":     schema.IdentityConfigSpec,
			"listener":     server.ListenerSpec,
			"userproperty": schema.UserSchemaExtension,
		},
		ConfigTarget: &cfg,
		RouteSetupFunc: func(grp gin.IRouter) error {
			apis := grp.Group("/api/", app.ExtractSessionUser())
			{
				identityapi.Setup(apis.Group("identity"))
				customerapi.Setup(apis.Group("customer"))
			}

			return nil
		},
	})
	if err != nil {
		logger.Fatalf(ctx, "failed to boot service: %s", err)
	}

	customers, err := customerdb.New(ctx, cfg.DatabaseURI, cfg.DatabaseName)
	if err != nil {
		logger.Fatalf(ctx, "%s", err.Error())
	}

	identities, err := identitydb.New(ctx, instance.ConfigurationDirectory, cfg.UserProperties)
	if err != nil {
		logger.Fatalf(ctx, "failed to prepare database: %s", err)
	}

	matcher := permission.NewMatcher(permission.NewResolver(identities))

	// Create a new application context and make sure it's added
	// to each incoming HTTP Request.
	appCtx := app.NewApp(&cfg, matcher, identities, customers)
	instance.Server().WithPreHandler(app.AddToRequest(appCtx))

	// run the server.
	if err := instance.Serve(); err != nil {
		logger.Fatalf(ctx, "failed to serve: %s", err)
	}
}
