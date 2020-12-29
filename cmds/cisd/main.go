package main

import (
	"context"

	"github.com/gin-gonic/gin"
	"github.com/ppacher/system-conf/conf"
	"github.com/spf13/cobra"
	"github.com/tierklinik-dobersberg/cis/internal/api/customerapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/doorapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/identityapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/rosterapi"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/database/customerdb"
	"github.com/tierklinik-dobersberg/cis/internal/database/identitydb"
	"github.com/tierklinik-dobersberg/cis/internal/database/rosterdb"
	"github.com/tierklinik-dobersberg/cis/internal/openinghours"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/internal/schema"
	"github.com/tierklinik-dobersberg/logger"
	"github.com/tierklinik-dobersberg/service/server"
	"github.com/tierklinik-dobersberg/service/service"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
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
	globalConf = append(globalConf, schema.MqttSpec...)

	instance, err := service.Boot(service.Config{
		ConfigFileName: "cis.conf",
		ConfigFileSpec: conf.FileSpec{
			"global":       globalConf,
			"import":       schema.VetInfSpec,
			"listener":     server.ListenerSpec,
			"userproperty": schema.UserSchemaExtension,
			"openinghour":  schema.OpeningHoursSpec,
		},
		ConfigTarget: &cfg,
		RouteSetupFunc: func(grp gin.IRouter) error {
			apis := grp.Group("/api/", app.ExtractSessionUser())
			{
				identityapi.Setup(apis.Group("identity"))
				customerapi.Setup(apis.Group("customer"))
				rosterapi.Setup(apis.Group("dutyroster"))
				doorapi.Setup(apis.Group("door"))
			}

			return nil
		},
	})
	if err != nil {
		logger.Fatalf(ctx, "failed to boot service: %s", err)
	}

	mongoClient := getMongoClient(ctx, cfg.DatabaseURI)

	customers, err := customerdb.NewWithClient(ctx, cfg.DatabaseName, mongoClient)
	if err != nil {
		logger.Fatalf(ctx, "%s", err.Error())
	}

	identities, err := identitydb.New(ctx, instance.ConfigurationDirectory, cfg.UserProperties)
	if err != nil {
		logger.Fatalf(ctx, "failed to prepare database: %s", err)
	}

	rosters, err := rosterdb.NewWithClient(ctx, cfg.DatabaseName, mongoClient)
	if err != nil {
		logger.Fatalf(ctx, "%s", err.Error())
	}

	matcher := permission.NewMatcher(permission.NewResolver(identities))

	door := getDoorInterface(ctx, cfg.MqttConfig)
	holidayCache := openinghours.NewHolidayCache()
	doorController, err := openinghours.NewDoorController(cfg.Config, cfg.OpeningHours, holidayCache, door)
	if err != nil {
		logger.Fatalf(ctx, "%s", err.Error())
	}

	// Create a new application context and make sure it's added
	// to each incoming HTTP Request.
	appCtx := app.NewApp(instance, &cfg, matcher, identities, customers, rosters, doorController)
	instance.Server().WithPreHandler(app.AddToRequest(appCtx))

	return appCtx
}

func getDoorInterface(ctx context.Context, cfg schema.MqttConfig) openinghours.DoorInterfacer {
	cli, err := openinghours.NewMqttDoor(cfg)
	if err != nil {
		logger.Fatalf(ctx, err.Error())
	}

	return cli
}

func getMongoClient(ctx context.Context, uri string) *mongo.Client {
	clientConfig := options.Client().ApplyURI(uri)
	client, err := mongo.NewClient(clientConfig)
	if err != nil {
		logger.Fatalf(ctx, err.Error())
	}

	if err := client.Connect(ctx); err != nil {
		logger.Fatalf(ctx, err.Error())
	}

	return client
}

func runMain() {
	ctx := context.Background()
	app := getApp(ctx)

	// run the server.
	if err := app.Instance.Serve(); err != nil {
		logger.Fatalf(ctx, "failed to serve: %s", err)
	}

	logger.Infof(ctx, "Service stopped successfully")
}
