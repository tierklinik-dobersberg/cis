package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"path/filepath"
	"time"

	goruntime "runtime"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/labstack/echo/v4"
	"github.com/ppacher/system-conf/conf"
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
	"github.com/tierklinik-dobersberg/cis/internal/identity"
	"github.com/tierklinik-dobersberg/cis/internal/importer"
	"github.com/tierklinik-dobersberg/cis/internal/infoscreen/layouts"
	"github.com/tierklinik-dobersberg/cis/internal/integration/mongolog"
	"github.com/tierklinik-dobersberg/cis/internal/openinghours"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/internal/roster"
	"github.com/tierklinik-dobersberg/cis/internal/voicemail"
	"github.com/tierklinik-dobersberg/cis/pkg/cache"
	"github.com/tierklinik-dobersberg/cis/pkg/confutil"
	"github.com/tierklinik-dobersberg/cis/pkg/models/identity/v1alpha"
	"github.com/tierklinik-dobersberg/cis/pkg/svcenv"
	tracemw "github.com/tierklinik-dobersberg/cis/pkg/trace"
	"github.com/tierklinik-dobersberg/cis/runtime"
	"github.com/tierklinik-dobersberg/cis/runtime/autologin"
	"github.com/tierklinik-dobersberg/cis/runtime/configprovider/fileprovider"
	"github.com/tierklinik-dobersberg/cis/runtime/configprovider/mongoprovider"
	"github.com/tierklinik-dobersberg/cis/runtime/httpcond"
	"github.com/tierklinik-dobersberg/cis/runtime/mailsync"
	"github.com/tierklinik-dobersberg/cis/runtime/schema"
	"github.com/tierklinik-dobersberg/cis/runtime/session"
	"github.com/tierklinik-dobersberg/cis/runtime/tasks"
	"github.com/tierklinik-dobersberg/cis/runtime/trigger"
	"github.com/tierklinik-dobersberg/logger"
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

	// All available/build-in identity providers.
	_ "github.com/tierklinik-dobersberg/cis/internal/identity/providers"
	// Exec trigger type.
	_ "github.com/tierklinik-dobersberg/cis/runtime/execer"
	// SendMail trigger type and SMTP support.
	_ "github.com/tierklinik-dobersberg/cis/runtime/mailer"
	// Twilio trigger type.
	_ "github.com/tierklinik-dobersberg/cis/runtime/twilio"
	// MQTT trigger type.
	runtimeMQTT "github.com/tierklinik-dobersberg/cis/runtime/mqtt"
	// VetInf importer.
	_ "github.com/tierklinik-dobersberg/cis/internal/importer/vetinf"
	// Neumayr importer.
	_ "github.com/tierklinik-dobersberg/cis/internal/importer/neumayr"
	// CardDAV importer.
	_ "github.com/tierklinik-dobersberg/cis/internal/importer/carddav"
	// Task: Find linkable customers.
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

// trunk-ignore(golangci-lint/gocognit)
func getApp(baseCtx context.Context) (*app.App, *tracesdk.TracerProvider, context.Context) {
	var (
		sessionManager = new(session.Manager)
	)

	log.Printf("CIS - running on %s (%s)", goruntime.GOOS, goruntime.GOARCH)

	// setup logging
	logApt := new(logAdapter)
	logApt.addAdapter(new(logger.StdlibAdapter))
	logger.SetDefaultAdapter(logApt)

	// load the configuration file
	cfg, cfgFile, err := loadConfig()
	if err != nil {
		log.Fatalf("configuration: %s", err)
	}

	//
	// configure the log-level as set by the user
	//
	lvl, err := cfgspec.ParseLogLevel(cfg.LogLevel)
	if err != nil {
		log.Fatalf("failed to parse log-level: %s", err)
	}
	logApt.setMaxSeverity(lvl)

	//
	// prepare tracing
	//
	var ctx = baseCtx
	var tracer *tracesdk.TracerProvider
	if cfg.JaegerTracingURL != "" {
		var span trace.Span
		tracer, err = tracerProvider(&cfg.Config)
		if err != nil {
			log.Fatalf("failed to configure trace provider: %s", err)
		}
		otel.SetTracerProvider(tracer)

		tr := tracer.Tracer("")
		ctx, span = tr.Start(ctx, "init")
		defer span.End()
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
		logApt.addAdapter(mongoLogger)
	}

	//
	// At this point we can prepare the actual configuration provider
	//
	switch cfg.ConfigProvider {
	case "file":
		// for the file provider we should re-validate the configuration file but
		// this time we validate the global schema as wel and we don't allow unknown
		// sections
		if err := conf.ValidateFile(cfgFile, confutil.MultiSectionRegistry{
			globalConfigFile,
			runtime.GlobalSchema,
		}); err != nil {
			logger.Fatalf(ctx, "failed to validate runtime configuration: %s", err)
		}
		runtime.GlobalSchema.SetProvider(fileprovider.New(cfgFile))

	case "mongo":
		runtime.GlobalSchema.SetProvider(mongoprovider.New(mongoClient, cfg.DatabaseName, "config"))

	default:
		logger.Fatalf(ctx, "invalid configuration provider: %s", cfg.ConfigProvider)
	}
	logger.Infof(ctx, "config-provider: using the %q provider", cfg.ConfigProvider)

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

	identities, err := identity.DefaultRegistry.Create(ctx, cfg.IdentityBackend, cfgFile, identity.Environment{
		ConfigurationDirectory:  svcenv.Env().ConfigurationDirectory,
		MongoClient:             mongoClient,
		MongoDatabaseName:       cfg.DatabaseName,
		UserPropertyDefinitions: cfg.UserProperties,
		Global:                  &cfg.Config,
		ConfigSchema:            runtime.GlobalSchema,
	})
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
	// setup voicemails. We don't need a reference to the voicemail manager
	// here.
	//
	if _, err := voicemail.NewManager(
		ctx,
		cfg.Country,
		mailsyncManager,
		customers,
		voicemails,
		runtime.GlobalSchema,
	); err != nil {
		logger.Fatalf(ctx, "voicemail: %s", err)
	}

	logger.Infof(ctx, "database system initialized")

	//
	// prepare MQTT client and connect to broker
	//
	// FIXME(ppacher): remove as soon as the door interfacer can be configured
	var doorInterfacer door.Interfacer = door.NoOp{}
	var mqttConfigs []runtimeMQTT.ConnectionConfig

	if err := runtime.GlobalSchema.DecodeSection(ctx, "MQTT", &mqttConfigs); err != nil {
		logger.Fatalf(ctx, "mqtt: %s", err.Error())
	}

	if len(mqttConfigs) > 0 {
		mqttClient, err := mqttConfigs[0].GetClient(ctx)
		if err != nil {
			logger.Fatalf(ctx, "mqtt-config: %s", err.Error())
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

		doorInterfacer = getDoorInterface(ctx, mqttClient)
	} else {
		logger.Errorf(ctx, "failed to find a MQTT configuration")
	}

	//
	// prepare opeing hours controller
	//
	holidayCache := openinghours.NewHolidayCache()
	openingHoursCtrl, err := openinghours.New(ctx, cfg.Config, runtime.GlobalSchema, holidayCache)
	if err != nil {
		logger.Fatalf(ctx, "opening-hours-controler: %s", err.Error())
	}

	//
	// prepare entry door controller
	//
	doorController, err := door.NewDoorController(openingHoursCtrl, doorInterfacer)
	if err != nil {
		logger.Fatalf(ctx, "door-controler: %s", err.Error())
	}

	//
	// Configure the session manager
	//
	userProvider := session.UserProviderFunc(func(ctx context.Context, name string) (*v1alpha.User, error) {
		ctx = identity.WithScope(ctx, identity.Internal)
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
	autoLoginManager, err := autologin.NewManager(
		ctx,
		sessionManager,
		httpcond.DefaultRegistry,
		cfgFile.GetAll("Autologin"),
	)
	if err != nil {
		logger.Fatalf(ctx, "autologin-manager: %s", err.Error())
	}

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
		cfg,
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
	if _, err := trigger.DefaultRegistry.LoadFiles(ctx, runtime.GlobalSchema, svcenv.Env().ConfigurationDirectory); err != nil {
		logger.Fatalf(ctx, "triggers: %s", err)
	}

	logger.Infof(ctx, "initialization complete")

	return appCtx, tracer, app.With(baseCtx, appCtx)
}

func setupAPI(app *app.App, grp *echo.Echo) {
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
			return c.NoContent(http.StatusOK)
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

	app, traceProvider, ctx := getApp(ctx)

	// Cleanly shutdown and flush telemetry when the application exits.
	if traceProvider != nil {
		defer func(ctx context.Context) {
			// Do not make the application hang when it is shutdown.
			ctx, cancel = context.WithTimeout(ctx, time.Second*5)
			defer cancel()
			if err := traceProvider.Shutdown(ctx); err != nil {
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
	if traceProvider != nil {
		srv.Use(tracemw.WithConfig(tracemw.Config{
			Skipper: func(c echo.Context) bool {
				// skip the health-check endpoint because it creates a lot of traces
				// but does not provide any real value ...
				return c.Path() == "/api/"
			},
		}))
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
