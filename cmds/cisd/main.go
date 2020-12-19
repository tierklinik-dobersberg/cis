package main

import (
	"context"

	"github.com/gin-gonic/gin"
	"github.com/ppacher/system-conf/conf"
	"github.com/spf13/cobra"
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
	cmd := getRootCommand()

	if err := cmd.Execute(); err != nil {
		logger.Fatalf(context.Background(), err.Error())
	}
}

func getRootCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use: "cisd",
		Run: func(_ *cobra.Command, _ []string) {
			runMain()
		},
	}

	cmd.AddCommand(
		getImportCommand(),
	)

	return cmd
}

func getApp(ctx context.Context) *app.App {
	var cfg app.Config

	globalConf := conf.SectionSpec{}

	globalConf = append(globalConf, schema.ConfigSpec...)
	globalConf = append(globalConf, schema.DatabaseSpec...)
	globalConf = append(globalConf, schema.IdentityConfigSpec...)

	instance, err := service.Boot(service.Config{
		ConfigFileName: "cis.conf",
		ConfigFileSpec: conf.FileSpec{
			"global":       globalConf,
			"import":       schema.VetInfSpec,
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
	appCtx := app.NewApp(instance, &cfg, matcher, identities, customers)
	instance.Server().WithPreHandler(app.AddToRequest(appCtx))

	return appCtx
}

func runMain() {
	ctx := context.Background()
	app := getApp(ctx)

	// run the server.
	if err := app.Instance.Serve(); err != nil {
		logger.Fatalf(ctx, "failed to serve: %s", err)
	}
}
