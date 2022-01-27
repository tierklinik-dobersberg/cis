package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	goruntime "runtime"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/labstack/echo/v4"
	"github.com/spf13/cobra"
	"github.com/tierklinik-dobersberg/cis/internal/api/calendarapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/calllogapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/cctvapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/commentapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/configapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/customerapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/doorapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/externalapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/holidayapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/identityapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/importapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/infoscreenapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/openinghoursapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/patientapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/resourceapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/rosterapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/statsapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/suggestionapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/triggerapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/voicemailapi"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/calendar/google"
	"github.com/tierklinik-dobersberg/cis/internal/cctv"
	"github.com/tierklinik-dobersberg/cis/internal/cfgspec"
	"github.com/tierklinik-dobersberg/cis/internal/database/calllogdb"
	"github.com/tierklinik-dobersberg/cis/internal/database/commentdb"
	"github.com/tierklinik-dobersberg/cis/internal/database/customerdb"
	"github.com/tierklinik-dobersberg/cis/internal/database/infoscreendb"
	"github.com/tierklinik-dobersberg/cis/internal/database/patientdb"
	"github.com/tierklinik-dobersberg/cis/internal/database/resourcedb"
	"github.com/tierklinik-dobersberg/cis/internal/database/voicemaildb"
	"github.com/tierklinik-dobersberg/cis/internal/door"
	"github.com/tierklinik-dobersberg/cis/internal/identity/providers/file"
	"github.com/tierklinik-dobersberg/cis/internal/importer"
	"github.com/tierklinik-dobersberg/cis/internal/infoscreen/layouts"
	"github.com/tierklinik-dobersberg/cis/internal/integration/mongolog"
	"github.com/tierklinik-dobersberg/cis/internal/integration/rocket"
	"github.com/tierklinik-dobersberg/cis/internal/openinghours"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/internal/roster"
	"github.com/tierklinik-dobersberg/cis/internal/voicemail"
	"github.com/tierklinik-dobersberg/cis/pkg/cache"
	"github.com/tierklinik-dobersberg/cis/pkg/confutil"
	"github.com/tierklinik-dobersberg/cis/pkg/models/identity/v1alpha"
	tracemw "github.com/tierklinik-dobersberg/cis/pkg/trace"
	"github.com/tierklinik-dobersberg/cis/runtime/autologin"
	"github.com/tierklinik-dobersberg/cis/runtime/httpcond"
	"github.com/tierklinik-dobersberg/cis/runtime/mailsync"
	"github.com/tierklinik-dobersberg/cis/runtime/schema"
	"github.com/tierklinik-dobersberg/cis/runtime/session"
	"github.com/tierklinik-dobersberg/cis/runtime/tasks"
	"github.com/tierklinik-dobersberg/cis/runtime/trigger"
	"github.com/tierklinik-dobersberg/logger"
	"github.com/tierklinik-dobersberg/service/runtime"
	"github.com/tierklinik-dobersberg/service/service"
	"github.com/tierklinik-dobersberg/service/svcenv"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.opentelemetry.io/contrib/instrumentation/go.mongodb.org/mongo-driver/mongo/otelmongo"
	"go.opentelemetry.io/otel"
	tracesdk "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/trace"

	//
	// underscore imports that register themself somewhere.
	//

	// Exec trigger type.
	_ "github.com/tierklinik-dobersberg/cis/runtime/execer"
	// SendMail trigger type and SMTP support.
	_ "github.com/tierklinik-dobersberg/cis/runtime/mailer"
	// Twilio trigger type.
	_ "github.com/tierklinik-dobersberg/cis/runtime/twilio"
	// MQTT trigger type.
	_ "github.com/tierklinik-dobersberg/cis/internal/integration/mqtt"
	// VetInf importer.
	_ "github.com/tierklinik-dobersberg/cis/internal/importer/vetinf"
	// Neumayr importer.
	_ "github.com/tierklinik-dobersberg/cis/internal/importer/neumayr"
	// CardDAV importer.
	_ "github.com/tierklinik-dobersberg/cis/internal/importer/carddav"
	// Task: Find linkable customers.
	//_ "github.com/tierklinik-dobersberg/cis/internal/tasks/linkable"
	// Schema migrations.
	_ "github.com/tierklinik-dobersberg/cis/migrations"
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

func getApp(baseCtx context.Context) (*app.App, *tracesdk.TracerProvider, context.Context) {
	var (
		cfg            app.Config
		sessionManager = new(session.Manager)
	)

	log.Printf("CIS - running on %s (%s)", goruntime.GOOS, goruntime.GOARCH)

	instance, err := service.Boot(service.Config{
		UseStdlibLogAdapter: true,
		ConfigFileName:      "cis.conf",
		ConfigDirectory:     "conf.d",
		ConfigSchema: confutil.MultiSectionRegistry{
			globalConfigFile,
			runtime.GlobalSchema,
		},
		ConfigTarget:  &cfg,
		DisableServer: true,
	})
	if err != nil {
		log.Fatalf("failed to boot service: %s", err)
	}

	//
	// configure the log-level as set by the user
	//
	lvl, err := cfgspec.ParseLogLevel(cfg.LogLevel)
	if err != nil {
		log.Fatalf("failed to parse log-level: %s", err)
	}
	instance.SetLogLevel(lvl)

	//
	// prepare tracing
	//
	var ctx = baseCtx
	var tp *tracesdk.TracerProvider
	if cfg.JaegerTracingURL != "" {
		var span trace.Span
		tp, err = tracerProvider(&cfg.Config)
		if err != nil {
			log.Fatalf("failed to configure trace provider: %s", err)
		}
		otel.SetTracerProvider(tp)

		tr := tp.Tracer("")
		ctx, span = tr.Start(ctx, "init")
		defer span.End()
	}

	// add the configuration file to the global schema
	// so packages can decode from it.
	runtime.GlobalSchema.SetFile(instance.ConfigFile())

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

		instance.AddLogger(logger.AdapterFunc(func(t time.Time, s logger.Severity, msg string, f logger.Fields) {
			if s != logger.Error {
				return
			}
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
	// prepare the mongodb client and maybe setup log-forwarding to mongodb
	//
	mongoClient := getMongoClient(ctx, cfg.DatabaseURI)

	if cfg.MongoLogConfig.Enabled {
		mongoLogger, err := mongolog.NewWithClient(ctx, cfg.DatabaseName, mongoClient, cfg.MongoLogConfig)
		if err != nil {
			logger.Fatalf(ctx, "mongolog: %s", err.Error())
		}
		instance.AddLogger(mongoLogger)
	}

	//
	// Apply any pending migrations
	//
	schemaDB, err := schema.NewDatabaseFromClient(ctx, cfg.DatabaseName, mongoClient)
	if err != nil {
		logger.Fatalf(ctx, "schemadb: %s", err.Error())
	}
	migrated, err := schema.ApplyMigrations(ctx, schemaDB, mongoClient.Database(cfg.DatabaseName))
	if err != nil {
		logger.Fatalf(ctx, "failed to apply migrations: %s", err)
	}
	if migrated {
		logger.Infof(ctx, "successfully applied schema migrations")
	} else {
		logger.Infof(ctx, "nothing to migrate ...")
	}

	//
	// Load any resource file definitions
	//
	resources := resourcedb.NewRegistry()
	if err := resourcedb.LoadFiles(resources, svcenv.Env().ConfigurationDirectory); err != nil {
		logger.Fatalf(ctx, "failed to load resource files: %s", err.Error())
	}

	//
	// prepare databases and everything that requires MongoDB
	//
	cache, err := cache.NewCache(
		ctx,
		cache.Mount{
			Store: cache.NewMongoStore(ctx, cfg.DatabaseName, "cache", mongoClient),
			Path:  "persist",
		},
		cache.Mount{
			Store: cache.NewMemoryStore(),
			Path:  "ephemeral",
		},
	)
	if err != nil {
		logger.Fatalf(ctx, "cache: %s", err.Error())
	}

	customers, err := customerdb.NewWithClient(ctx, cfg.DatabaseName, mongoClient)
	if err != nil {
		logger.Fatalf(ctx, "customerdb: %s", err.Error())
	}

	patients, err := patientdb.NewWithClient(ctx, cfg.DatabaseName, mongoClient)
	if err != nil {
		logger.Fatalf(ctx, "patientdb: %s", err.Error())
	}

	identities, err := file.New(ctx, instance.ConfigurationDirectory, cfg.Country, cfg.UserProperties, httpcond.DefaultRegistry)
	if err != nil {
		logger.Fatalf(ctx, "file: %s", err)
	}

	rosters, err := roster.NewWithClient(ctx, cfg.DatabaseName, mongoClient)
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

	store := mailSyncStore(mongoClient, cfg.DatabaseName)
	mailsyncManager, err := mailsync.NewManager(ctx, store)
	if err != nil {
		logger.Fatalf(ctx, "mailsync: %s", err.Error())
	}

	voicemails, err := voicemaildb.NewWithClient(ctx, cfg.DatabaseName, mongoClient)
	if err != nil {
		logger.Fatalf(ctx, "voicemaildb: %s", err)
	}

	calendarService, err := google.New(ctx, cfg.GoogleCalendar)
	if err != nil {
		logger.Fatalf(ctx, "calendar: %s", err)
	}

	infoScreens, err := infoscreendb.NewWithClient(ctx, cfg.DatabaseName, mongoClient)
	if err != nil {
		logger.Fatalf(ctx, "infoscreendb: %s", err)
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

	logger.Infof(ctx, "database system initialized")

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

	logger.Infof(ctx, "successfully connected to MQTT")

	//
	// prepare opeing hours controller
	//
	holidayCache := openinghours.NewHolidayCache()
	openingHoursCtrl, err := openinghours.New(cfg.Config, cfg.OpeningHours, holidayCache)
	if err != nil {
		logger.Fatalf(ctx, "opening-hours-controler: %s", err.Error())
	}

	//
	// prepare entry door controller
	//
	dint := getDoorInterface(ctx, mqttClient)
	doorController, err := door.NewDoorController(openingHoursCtrl, dint)
	if err != nil {
		logger.Fatalf(ctx, "door-controler: %s", err.Error())
	}

	//
	// Configure the session manager
	//
	userProvider := session.UserProviderFunc(func(ctx context.Context, name string) (*v1alpha.User, error) {
		ctx = file.WithScope(ctx, file.Internal)
		u, err := identities.GetUser(ctx, name)
		if err != nil {
			return nil, err
		}
		return &u.User, nil
	})
	if err := sessionManager.Configure(
		userProvider,
		&cfg.IdentityConfig,
		cfg.Secret,
		cfg.BaseURL,
		cache,
		"ephemeral/",
	); err != nil {
		logger.Fatalf(ctx, "session-manager: %s", err.Error())
	}

	//
	// Create the autologin manager
	//
	autoLoginManager := autologin.NewManager(
		ctx,
		sessionManager,
		httpcond.DefaultRegistry,
		identities.GetAutologinUsers(ctx),
		identities.GetAutologinRoles(ctx),
	)

	//
	// prepare
	//
	cctvManager := &cctv.Manager{}
	if err := cctvManager.LoadDefinitions(svcenv.Env().ConfigurationDirectory); err != nil {
		logger.Fatalf(ctx, "cctv-manager: %s", err.Error())
	}

	//
	// Prepare infoscreen module
	//
	var layoutStore layouts.Store = new(layouts.NoopStore)
	if cfg.InfoScreenConfig.Enabled {
		// Make sure layout paths are relative to the CONFIGURATION_DIRECTORY
		paths := make([]string, len(cfg.InfoScreenConfig.LayoutPaths))
		for idx, path := range cfg.InfoScreenConfig.LayoutPaths {
			if !filepath.IsAbs(path) {
				path = filepath.Join(svcenv.Env().ConfigurationDirectory, path)
			}
			paths[idx] = path
		}

		var err error
		layoutStore, err = layouts.NewFileStore(ctx, paths)
		if err != nil {
			logger.Fatalf(ctx, "layouts.NewFileStore: %w", err)
		}
	}

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
		calendarService,
		resources,
		cctvManager,
		layoutStore,
		infoScreens,
		cache,
		autoLoginManager,
	)

	ctx = app.With(baseCtx, appCtx)

	logger.Infof(ctx, "application initialized, starting tasks ...")

	//
	// Start the task manager
	// All tasks can get access to appCtx by using app.From(ctx).
	//
	tasks.DefaultManager.Start(ctx)

	//
	// Prepare triggers
	//
	// update the timezone of the default trigger registry
	trigger.DefaultRegistry.SetLocation(appCtx.Location())

	// TODO(ppacher): this currently requires app.App to have been associated with ctx.
	// I'm somewhat unhappy with that requirement so make it go away in the future.
	logger.Infof(ctx, "tasks started, loading trigger files with %d available types", trigger.DefaultRegistry.TypeCount())
	if _, err := trigger.DefaultRegistry.LoadFiles(ctx, runtime.GlobalSchema, instance.ConfigurationDirectory); err != nil {
		logger.Fatalf(ctx, "triggers: %s", err)
	}

	logger.Infof(ctx, "initialization complete")

	return appCtx, tp, app.With(baseCtx, appCtx)
}

func setupAPI(app *app.App, grp *echo.Echo) error {
	apis := grp.Group(
		"/api/",
		app.Sessions.Middleware,
		func(next echo.HandlerFunc) echo.HandlerFunc {
			return func(c echo.Context) error {
				if app.Autologin != nil {
					app.Autologin.PerformAutologin(c)
				}
				return next(c)
			}
		},
	)

	// alive check
	{
		apis.GET("", func(c echo.Context) error {
			c.NoContent(http.StatusOK)
			return nil
		})
	}
	// API endpoints
	{
		// identityapi provides user and session endpoints
		identityapi.Setup(app, apis.Group("identity/"))
		// customerapi provides customer database endpoints
		customerapi.Setup(app, apis.Group("customer/", session.Require()))
		// rosterapi provides access to the electronic duty roster
		rosterapi.Setup(app, apis.Group("dutyroster/", session.Require()))
		// doorapi provides access to the entry door controller.
		doorapi.Setup(app, apis.Group("door/", session.Require()))
		// externalapi provides specialized APIs for integration
		// with external services (like the phone-system).
		externalapi.Setup(app, apis.Group("external/", session.Require()))
		// holidayapi provides access to all holidays in the
		// configured countries.
		holidayapi.Setup(app, apis.Group("holidays/", session.Require()))
		// calllog allows to retrieve and query call log records
		calllogapi.Setup(app, apis.Group("calllogs/", session.Require()))
		// configapi provides configuration specific endpoints.
		configapi.Setup(app, apis.Group("config/", session.Require()))
		// importapi provides import support for customer data
		importapi.Setup(app, apis.Group("import/", session.Require()))
		// commentapi manages the comment system from cis
		commentapi.Setup(app, apis.Group("comments/", session.Require()))
		// voicemailapi allows access to voicemail mailboxes
		voicemailapi.Setup(app, apis.Group("voicemail/", session.Require()))
		// patientapi allows access to patient data
		patientapi.Setup(app, apis.Group("patient/", session.Require()))
		// calendarapi provides access to calendar data
		calendarapi.Setup(app, apis.Group("calendar/", session.Require()))
		// openinghoursapi provides access to the configured openinghours
		openinghoursapi.Setup(app, apis.Group("openinghours/", session.Require()))
		// resourceapi provides access to limited resource definitions
		resourceapi.Setup(app, apis.Group("resources/", session.Require()))
		// cctv allows streaming access to security cameras
		cctvapi.Setup(app, apis.Group("cctv/", session.Require()))
		// direct access to trigger instances
		triggerapi.Setup(app, apis.Group("triggers/", session.Require()))
		// access to the infoscreen management api
		infoscreenapi.Setup(app, apis.Group("infoscreen/", session.Require()))
		// access to the infoscreen show player
		infoscreenapi.SetupPlayer(app, apis.Group("infoscreen/"))
		// access to the suggestion API
		suggestionapi.Setup(app, apis.Group("suggestion/", session.Require()))

		statsapi.Setup(app, apis.Group("stats/"))
	}

	return nil
}

func getDoorInterface(ctx context.Context, client mqtt.Client) door.Interfacer {
	cli, err := door.NewMqttDoor(client)
	if err != nil {
		logger.Fatalf(ctx, err.Error())
	}

	return cli
}

func getMongoClient(ctx context.Context, uri string) *mongo.Client {
	monitor := otelmongo.NewMonitor()
	clientConfig := options.Client().ApplyURI(uri).SetMonitor(monitor)
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

	app, tp, ctx := getApp(ctx)

	// Cleanly shutdown and flush telemetry when the application exits.
	if tp != nil {
		defer func(ctx context.Context) {
			// Do not make the application hang when it is shutdown.
			ctx, cancel = context.WithTimeout(ctx, time.Second*5)
			defer cancel()
			if err := tp.Shutdown(ctx); err != nil {
				log.Fatal(err)
			}
		}(ctx)
	}

	logger.Infof(ctx, "starting importers ...")

	importManager, err := importer.New(ctx, app)
	if err != nil {
		logger.Fatalf(ctx, "failed to create importers: %s", err)
	}

	if err := importManager.Start(ctx); err != nil {
		logger.Fatalf(ctx, "failed to start importers: %s", err)
	}

	logger.Infof(ctx, "starting door scheduler ...")

	if err := app.Door.Start(); err != nil {
		logger.Fatalf(ctx, "failed to start door scheduler: %s", err)
	}

	// we log on error so this one get's forwarded to error reporters.
	logger.Errorf(ctx, "startup complete, serving API ....")

	// run the server.
	srv, err := setupServer(ctx, app)
	if err != nil {
		logger.Fatalf(ctx, "failed to setup server: %s", err)
	}
	if tp != nil {
		srv.Use(tracemw.TraceWithConfig(tracemw.DefaultConfig))
	}
	setupAPI(app, srv)

	if err := srv.Start(app.Config.Config.Listen); err != nil {
		logger.Fatalf(ctx, "failed to start listening: %s", err)
	}

	if err := app.Door.Stop(); err != nil {
		logger.Errorf(ctx, "failed to stop door scheduler: %s", err)
	}

	logger.Infof(ctx, "Service stopped successfully")
}

// CollectionName is the name of the mail-sync mongodb
// collection.
func mailSyncStore(mongoClient *mongo.Client, dbName string) mailsync.Store {
	const collectionName = "mail-sync-state"
	col := mongoClient.Database(dbName).Collection(collectionName)

	return &mailsync.SimpleStore{
		Load: func(ctx context.Context, name string) (*mailsync.State, error) {
			result := col.FindOne(ctx, bson.M{"name": name})
			if result.Err() != nil && !errors.Is(result.Err(), mongo.ErrNoDocuments) {
				return nil, fmt.Errorf("loading state: %w", result.Err())
			}

			if result.Err() == nil {
				var state mailsync.State
				if err := result.Decode(&state); err != nil {
					return nil, fmt.Errorf("decoding state: %w", err)
				}
				return &state, nil
			}
			return nil, nil
		},
		Save: func(ctx context.Context, state mailsync.State) error {
			opts := options.Replace().SetUpsert(true)
			if _, err := col.ReplaceOne(ctx, bson.M{"name": state.Name}, state, opts); err != nil {
				return err
			}
			return nil
		},
	}
}
