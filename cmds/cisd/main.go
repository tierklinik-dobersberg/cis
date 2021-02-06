package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/ppacher/system-conf/conf"
	"github.com/spf13/cobra"
	"github.com/tierklinik-dobersberg/cis/internal/api/calllogapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/commentapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/configapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/customerapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/doorapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/externalapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/holidayapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/identityapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/importapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/rosterapi"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/autologin"
	"github.com/tierklinik-dobersberg/cis/internal/database/calllogdb"
	"github.com/tierklinik-dobersberg/cis/internal/database/commentdb"
	"github.com/tierklinik-dobersberg/cis/internal/database/customerdb"
	"github.com/tierklinik-dobersberg/cis/internal/database/identitydb"
	"github.com/tierklinik-dobersberg/cis/internal/database/rosterdb"
	"github.com/tierklinik-dobersberg/cis/internal/errorlog"
	"github.com/tierklinik-dobersberg/cis/internal/httpcond"
	"github.com/tierklinik-dobersberg/cis/internal/httperr"
	"github.com/tierklinik-dobersberg/cis/internal/importer"
	"github.com/tierklinik-dobersberg/cis/internal/integration/rocket"
	"github.com/tierklinik-dobersberg/cis/internal/mailsync"
	"github.com/tierklinik-dobersberg/cis/internal/openinghours"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/internal/schema"
	"github.com/tierklinik-dobersberg/cis/internal/session"
	"github.com/tierklinik-dobersberg/logger"
	"github.com/tierklinik-dobersberg/service/server"
	"github.com/tierklinik-dobersberg/service/service"
	"github.com/tierklinik-dobersberg/service/svcenv"
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
		getDoorCommand(),
	)

	return cmd
}

func getApp(ctx context.Context) *app.App {
	// prepare logging
	logAdapter := errorlog.New(&logger.StdlibAdapter{})
	logger.SetDefaultAdapter(logAdapter)

	var cfg app.Config
	var autoLoginManager *autologin.Manager

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
			"integration":  schema.IntegrationConfigSpec,
		},
		ConfigTarget: &cfg,
		RouteSetupFunc: func(grp gin.IRouter) error {
			apis := grp.Group(
				"/api/",
				httperr.Middleware,
				session.Middleware,
				func(c *gin.Context) {
					if autoLoginManager != nil {
						autoLoginManager.PerformAutologin(c)
					}

					c.Next()
				},
			)
			{
				// identityapi provides user and session endpoints
				identityapi.Setup(apis.Group("identity"))
				// customerapi provides customer database endpoints
				customerapi.Setup(apis.Group("customer", session.Require()))
				// rosterapi provides access to the electronic duty roster
				rosterapi.Setup(apis.Group("dutyroster", session.Require()))
				// doorapi provides access to the entry door controller.
				doorapi.Setup(apis.Group("door", session.Require()))
				// externalapi provides specialized APIs for integration
				// with external services (like the phone-system).
				externalapi.Setup(apis.Group("external", session.Require()))
				// holidayapi provides access to all holidays in the
				// configured countries.
				holidayapi.Setup(apis.Group("holidays", session.Require()))
				// calllog allows to retrieve and query call log records
				calllogapi.Setup(apis.Group("calllogs", session.Require()))
				// configapi provides configuration specific endpoints.
				configapi.Setup(apis.Group("config", session.Require()))
				// importapi provides import support for customer data
				importapi.Setup(apis.Group("import", session.Require()))
				// commentapi manages the comment system from cis
				commentapi.Setup(apis.Group("comments", session.Require()))
			}

			return nil
		},
	})
	if err != nil {
		logger.Fatalf(ctx, "failed to boot service: %s", err)
	}

	//
	// There might be a ui.conf file so try to load it.
	//
	uiConf := filepath.Join(svcenv.Env().ConfigurationDirectory, "ui.conf")
	uiConfSpec := conf.FileSpec{
		"UI":           schema.UISpec,
		"ExternalLink": schema.ExternalLinkSpec,
	}

	if err := uiConfSpec.ParseFile(uiConf, &cfg.UI); err != nil && !os.IsNotExist(err) {
		logger.Fatalf(ctx, "failed to load ui.conf: %s", err)
	}

	//
	// configure rocket.chat error log integration
	//
	if cfg.IntegrationConfig.RocketChatAddress != "" {
		rocketClient, err := rocket.NewClient(cfg.IntegrationConfig.RocketChatAddress, nil)
		if err != nil {
			logger.Fatalf(ctx, "failed to configure rocketchat integration: %s", err)
		}

		logAdapter.AddErrorAdapter(logger.AdapterFunc(func(t time.Time, s logger.Severity, msg string, f logger.Fields) {
			content := rocket.WebhookContent{
				Text: msg,
				Attachments: []rocket.Attachment{
					{
						Title: "Error",
						Fields: []rocket.AttachmentField{
							{
								Title: "Time",
								Value: t.String(),
							},
						},
					},
				},
			}

			for k, v := range f {
				content.Attachments[0].Fields = append(content.Attachments[0].Fields, rocket.AttachmentField{
					Title: k,
					Value: fmt.Sprintf("%v", v),
				})
			}

			// ignore the return code because there's nothing we can do ...
			_ = rocketClient.Send(ctx, content)
		}))
	}

	//
	// prepare databases
	//
	mongoClient := getMongoClient(ctx, cfg.DatabaseURI)

	customers, err := customerdb.NewWithClient(ctx, cfg.DatabaseName, mongoClient)
	if err != nil {
		logger.Fatalf(ctx, "%s", err.Error())
	}

	identities, err := identitydb.New(ctx, instance.ConfigurationDirectory, cfg.Country, cfg.UserProperties, httpcond.DefaultRegistry)
	if err != nil {
		logger.Fatalf(ctx, "failed to prepare database: %s", err)
	}

	rosters, err := rosterdb.NewWithClient(ctx, cfg.DatabaseName, mongoClient)
	if err != nil {
		logger.Fatalf(ctx, "%s", err.Error())
	}

	calllogs, err := calllogdb.NewWithClient(ctx, cfg.DatabaseName, cfg.Country, mongoClient)
	if err != nil {
		logger.Fatalf(ctx, "%s", err.Error())
	}

	comments, err := commentdb.NewWithClient(ctx, cfg.DatabaseName, mongoClient)
	if err != nil {
		logger.Fatalf(ctx, "%s", err.Error())
	}

	mailsyncManager, err := mailsync.NewManagerWithClient(ctx, cfg.DatabaseName, mongoClient)
	if err != nil {
		logger.Fatalf(ctx, "%s", err.Error())
	}

	matcher := permission.NewMatcher(permission.NewResolver(identities))

	//
	// prepare entry door controller
	//
	door := getDoorInterface(ctx, cfg.MqttConfig)
	holidayCache := openinghours.NewHolidayCache()
	doorController, err := openinghours.NewDoorController(cfg.Config, cfg.OpeningHours, holidayCache, door)
	if err != nil {
		logger.Fatalf(ctx, "%s", err.Error())
	}

	autoLoginManager = autologin.NewManager(ctx, identities, httpcond.DefaultRegistry)

	// Create a new application context and make sure it's added
	// to each incoming HTTP Request.
	appCtx := app.NewApp(
		instance,
		&cfg,
		matcher,
		identities,
		customers,
		rosters,
		comments,
		mailsyncManager,
		doorController,
		holidayCache,
		calllogs,
	)
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
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	app := getApp(ctx)

	importManager, err := importer.New(ctx, app)
	if err != nil {
		logger.Fatalf(ctx, "failed to create importers: %s", err)
	}

	if err := importManager.Start(ctx); err != nil {
		logger.Fatalf(ctx, "failed to start importers: %s", err)
	}

	if err := app.Door.Start(); err != nil {
		logger.Fatalf(ctx, "failed to start door scheduler: %s", err)
	}

	// run the server.
	if err := app.Instance.Serve(); err != nil {
		logger.Fatalf(ctx, "failed to serve: %s", err)
	}

	if err := app.Door.Stop(); err != nil {
		logger.Errorf(ctx, "failed to stop door scheduler: %s", err)
	}

	logger.Infof(ctx, "Service stopped successfully")
}
