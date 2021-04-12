package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/gin-gonic/gin"
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
	"github.com/tierklinik-dobersberg/cis/internal/api/patientapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/rosterapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/voicemailapi"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/autologin"
	"github.com/tierklinik-dobersberg/cis/internal/database/calllogdb"
	"github.com/tierklinik-dobersberg/cis/internal/database/commentdb"
	"github.com/tierklinik-dobersberg/cis/internal/database/customerdb"
	"github.com/tierklinik-dobersberg/cis/internal/database/identitydb"
	"github.com/tierklinik-dobersberg/cis/internal/database/patientdb"
	"github.com/tierklinik-dobersberg/cis/internal/database/rosterdb"
	"github.com/tierklinik-dobersberg/cis/internal/database/voicemaildb"
	"github.com/tierklinik-dobersberg/cis/internal/errorlog"
	"github.com/tierklinik-dobersberg/cis/internal/httpcond"
	"github.com/tierklinik-dobersberg/cis/internal/httperr"
	"github.com/tierklinik-dobersberg/cis/internal/importer"
	"github.com/tierklinik-dobersberg/cis/internal/integration/mongolog"
	"github.com/tierklinik-dobersberg/cis/internal/integration/rocket"
	"github.com/tierklinik-dobersberg/cis/internal/mailsync"
	"github.com/tierklinik-dobersberg/cis/internal/openinghours"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/internal/session"
	"github.com/tierklinik-dobersberg/cis/internal/trigger"
	"github.com/tierklinik-dobersberg/cis/internal/voicemail"
	"github.com/tierklinik-dobersberg/logger"
	"github.com/tierklinik-dobersberg/service/service"
	"github.com/tierklinik-dobersberg/service/svcenv"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	//
	// underscore imports that register themself somewhere
	//

	// MQTT trigger type
	_ "github.com/tierklinik-dobersberg/cis/internal/integration/mqtt"
	// Twilio trigger type
	_ "github.com/tierklinik-dobersberg/cis/internal/integration/twilio"
	// VetInf importer
	_ "github.com/tierklinik-dobersberg/cis/internal/importer/neumayr"
	// Neumayr importer
	_ "github.com/tierklinik-dobersberg/cis/internal/importer/vetinf"
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
		getDoorCommand(),
		getManCommand(),
		getValidateCommand(),
		getCalendarCommand(),
	)

	return cmd
}

func getApp(ctx context.Context) *app.App {
	// prepare logging
	logAdapter := errorlog.New(&logger.StdlibAdapter{})
	logger.SetDefaultAdapter(logAdapter)

	var cfg app.Config
	var autoLoginManager *autologin.Manager
	sessionManager := new(session.Manager)

	instance, err := service.Boot(service.Config{
		ConfigFileName: "cis.conf",
		ConfigFileSpec: globalConfigFile.Sections,
		ConfigTarget:   &cfg,
		RouteSetupFunc: func(grp gin.IRouter) error {
			apis := grp.Group(
				"/api/",
				httperr.Middleware,
				sessionManager.Middleware,
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
				// voicemailapi allows access to voicemail mailboxes
				voicemailapi.Setup(apis.Group("voicemail", session.Require()))
				// patientapi allows access to patient data
				patientapi.Setup(apis.Group("patient", session.Require()))
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
	if err := uiConfigFile.Sections.ParseFile(uiConf, &cfg.UI); err != nil && !os.IsNotExist(err) {
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
	// prepare databases and everything that requires MongoDB
	//
	mongoClient := getMongoClient(ctx, cfg.DatabaseURI)

	if cfg.MongoLogConfig.Enabled {
		mongoLogger, err := mongolog.NewWithClient(ctx, cfg.DatabaseName, mongoClient, cfg.MongoLogConfig)
		if err != nil {
			logger.Fatalf(ctx, "mongolog: %s", err.Error())
		}
		logAdapter.AddDefaultAdapter(mongoLogger)
	}

	customers, err := customerdb.NewWithClient(ctx, cfg.DatabaseName, mongoClient)
	if err != nil {
		logger.Fatalf(ctx, "customerdb: %s", err.Error())
	}

	patients, err := patientdb.NewWithClient(ctx, cfg.DatabaseName, mongoClient)
	if err != nil {
		logger.Fatalf(ctx, "patientdb: %s", err.Error())
	}

	identities, err := identitydb.New(ctx, instance.ConfigurationDirectory, cfg.Country, cfg.UserProperties, httpcond.DefaultRegistry)
	if err != nil {
		logger.Fatalf(ctx, "identitydb: %s", err)
	}

	rosters, err := rosterdb.NewWithClient(ctx, cfg.DatabaseName, mongoClient)
	if err != nil {
		logger.Fatalf(ctx, "rosterdb: %s", err.Error())
	}

	calllogs, err := calllogdb.NewWithClient(ctx, cfg.DatabaseName, cfg.Country, mongoClient)
	if err != nil {
		logger.Fatalf(ctx, "callogdb: %s", err.Error())
	}

	comments, err := commentdb.NewWithClient(ctx, cfg.DatabaseName, mongoClient)
	if err != nil {
		logger.Fatalf(ctx, "commentdb: %s", err.Error())
	}

	mailsyncManager, err := mailsync.NewManagerWithClient(ctx, cfg.DatabaseName, mongoClient)
	if err != nil {
		logger.Fatalf(ctx, "mailsync: %s", err.Error())
	}

	voicemails, err := voicemaildb.NewWithClient(ctx, cfg.DatabaseName, mongoClient)
	if err != nil {
		logger.Fatalf(ctx, "voicemaildb: %s", err)
	}

	matcher := permission.NewMatcher(permission.NewResolver(identities))

	//
	// setup voicemails
	//
	for _, vcfg := range cfg.VoiceMails {
		_, err := voicemail.New(
			ctx,
			customers,
			voicemails,
			vcfg,
			cfg.Country,
			mailsyncManager,
		)
		if err != nil {
			logger.Fatalf(ctx, "voicemail %s: %w", vcfg.Name, err)
		}
	}

	//
	// prepare MQTT client and connect to broker
	//
	mqttClient, err := cfg.MqttConfig.GetClient(ctx)
	if err != nil {
		logger.Fatalf(ctx, "mqtt: %s", err.Error())
	}

	// TODO(ppacher): try to connect in background
	for {
		if token := mqttClient.Connect(); token.Wait() && token.Error() != nil {
			logger.Errorf(ctx, "failed to connect to mqtt: %s", err)
			time.Sleep(time.Second)
			continue
		}
		break
	}

	//
	// prepare entry door controller
	//
	door := getDoorInterface(ctx, mqttClient)
	holidayCache := openinghours.NewHolidayCache()
	doorController, err := openinghours.NewDoorController(cfg.Config, cfg.OpeningHours, holidayCache, door)
	if err != nil {
		logger.Fatalf(ctx, "door-controler: %s", err.Error())
	}

	//
	// Configure the session manager
	//
	if err := sessionManager.Configure(identities, &cfg.IdentityConfig, &cfg.Config); err != nil {
		logger.Fatalf(ctx, "session-manager: %s", err.Error())
	}

	//
	// Create the autologin manager
	//
	autoLoginManager = autologin.NewManager(ctx, identities, httpcond.DefaultRegistry)

	//
	// Create a new application context and make sure it's added
	// to each incoming HTTP Request.
	//
	appCtx := app.NewApp(
		instance,
		&cfg,
		matcher,
		identities,
		customers,
		patients,
		rosters,
		comments,
		voicemails,
		mailsyncManager,
		doorController,
		sessionManager,
		holidayCache,
		calllogs,
		mqttClient,
	)
	instance.Server().WithPreHandler(app.AddToRequest(appCtx))

	//
	// Prepare triggers
	//
	// TODO(ppacher): this currently requires app.App to have been associated with ctx.
	// I'm somewhat unhappy with that requirement so make it go away in the future.
	//
	ctx = app.With(ctx, appCtx)
	logger.Infof(ctx, "%d trigger types available so far", trigger.DefaultRegistry.TypeCount())
	if err := trigger.DefaultRegistry.LoadFiles(ctx, instance.ConfigurationDirectory); err != nil {
		logger.Fatalf(ctx, "triggers: %s", err)
	}

	return appCtx
}

func getDoorInterface(ctx context.Context, client mqtt.Client) openinghours.DoorInterfacer {
	cli, err := openinghours.NewMqttDoor(client)
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
