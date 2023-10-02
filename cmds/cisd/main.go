package main

import (
	"context"
	"embed"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	goruntime "runtime"

	"github.com/bufbuild/connect-go"
	"github.com/labstack/echo/v4"
	"github.com/ppacher/system-conf/conf"
	"github.com/spf13/cobra"
	idmv1 "github.com/tierklinik-dobersberg/apis/gen/go/tkd/idm/v1"
	"github.com/tierklinik-dobersberg/cis/internal/api/calendarapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/calllogapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/cctvapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/commentapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/configapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/customerapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/doorapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/externalapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/holidayapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/importapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/infoscreenapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/openinghoursapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/patientapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/resourceapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/rosterapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/statsapi"
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
	"github.com/tierklinik-dobersberg/cis/internal/oncalloverwrite"
	"github.com/tierklinik-dobersberg/cis/internal/openinghours"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/internal/tmpl2pdf"
	"github.com/tierklinik-dobersberg/cis/internal/voicemail"
	"github.com/tierklinik-dobersberg/cis/pkg/cache"
	"github.com/tierklinik-dobersberg/cis/pkg/confutil"
	"github.com/tierklinik-dobersberg/cis/pkg/svcenv"
	tracemw "github.com/tierklinik-dobersberg/cis/pkg/trace"
	"github.com/tierklinik-dobersberg/cis/runtime"
	"github.com/tierklinik-dobersberg/cis/runtime/configprovider/fileprovider"
	"github.com/tierklinik-dobersberg/cis/runtime/configprovider/mongoprovider"
	"github.com/tierklinik-dobersberg/cis/runtime/event"
	"github.com/tierklinik-dobersberg/cis/runtime/execer"
	"github.com/tierklinik-dobersberg/cis/runtime/mailer"
	"github.com/tierklinik-dobersberg/cis/runtime/mailsync"
	runtimeMQTT "github.com/tierklinik-dobersberg/cis/runtime/mqtt"
	"github.com/tierklinik-dobersberg/cis/runtime/schema"
	"github.com/tierklinik-dobersberg/cis/runtime/session"
	"github.com/tierklinik-dobersberg/cis/runtime/tasks"
	"github.com/tierklinik-dobersberg/cis/runtime/trigger"
	"github.com/tierklinik-dobersberg/cis/runtime/twilio"
	"github.com/tierklinik-dobersberg/cis/runtime/webhook"
	"github.com/tierklinik-dobersberg/logger"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.opentelemetry.io/contrib/instrumentation/go.mongodb.org/mongo-driver/mongo/otelmongo"
	"go.opentelemetry.io/otel"
	tracesdk "go.opentelemetry.io/otel/sdk/trace"

	//
	// underscore imports that register themself somewhere.
	//

	// All available/build-in identity providers.
	_ "github.com/tierklinik-dobersberg/cis/internal/identity/providers"
	"github.com/tierklinik-dobersberg/cis/internal/identity/providers/idm"

	// Neumayr importer.
	"github.com/tierklinik-dobersberg/cis/internal/importer/carddav"
	_ "github.com/tierklinik-dobersberg/cis/internal/importer/neumayr"
	"github.com/tierklinik-dobersberg/cis/internal/importer/vetinf"

	// Task: Find linkable customers.
	// Schema migrations.
	_ "github.com/tierklinik-dobersberg/cis/migrations"
)

// go:embed ui
var static embed.FS

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
		tracer, err = tracerProvider(&cfg.Config)
		if err != nil {
			log.Fatalf("failed to configure trace provider: %s", err)
		}
		otel.SetTracerProvider(tracer)
	}

	//
	// prepare the mongodb client and maybe setup log-forwarding to mongodb
	//
	mongoClient := getMongoClient(ctx, cfg.DatabaseURI)

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
		ConfigurationDirectory: svcenv.Env().ConfigurationDirectory,
		MongoClient:            mongoClient,
		MongoDatabaseName:      cfg.DatabaseName,
		Global:                 &cfg.Config,
		ConfigSchema:           runtime.GlobalSchema,
	})
	if err != nil {
		logger.Fatalf(ctx, "file: %s", err)
	}

	overwrites, err := oncalloverwrite.NewWithClient(ctx, cfg.DatabaseName, mongoClient)
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
	doorController, err := door.NewDoorController(ctx, openingHoursCtrl, runtime.GlobalSchema, runtimeMQTT.DefaultConnectionManager)
	if err != nil {
		logger.Fatalf(ctx, "door-controler: %s", err.Error())
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
			logger.Fatalf(ctx, "layouts.NewFileStore: %s", err)
		}
	}

	triggerReg := trigger.NewRegistry(ctx, event.DefaultRegistry, cfg.Location(), runtime.GlobalSchema)

	if err := twilio.AddTriggerType(triggerReg); err != nil {
		logger.Fatalf(ctx, "failed to add trigger type twilio: %s", err)
	}
	if err := runtimeMQTT.AddTriggerType(triggerReg, runtimeMQTT.DefaultConnectionManager); err != nil {
		logger.Fatalf(ctx, "failed to add trigger type mqtt: %s", err)
	}
	if err := mailer.AddTriggerType(triggerReg); err != nil {
		logger.Fatalf(ctx, "failed to add trigger type mailer: %s", err)
	}
	if err := execer.AddTriggerType(triggerReg); err != nil {
		logger.Fatalf(ctx, "failed to add trigger type mailer: %s", err)
	}
	if err := webhook.AddTriggerType(triggerReg); err != nil {
		logger.Fatalf(ctx, "failed to add trigger type webhook: %s", err)
	}

	//
	// Setup PDf generation support
	//
	pdfCreator, err := tmpl2pdf.NewCreator(ctx, cfg.BaseURL, runtime.GlobalSchema)
	if err != nil {
		logger.Fatalf(ctx, "failed to setup tmpl2pdf: %s", err)
	}

	//
	// Create a new application context and make sure it's added
	// to each incoming HTTP Request.
	//
	appCtx := app.NewApp(
		cfg,
		matcher,
		customers,
		patients,
		overwrites,
		comments,
		voicemails,
		mailsyncManager,
		doorController,
		holidayCache,
		calllogs,
		calendarService,
		resources,
		cctvManager,
		layoutStore,
		infoScreens,
		cache,
		triggerReg,
		pdfCreator,
		os.Getenv("ROSTERD_SERVER"),
		identities.(*idm.Provider),
	)

	ctx = app.With(baseCtx, appCtx)

	logger.Infof(ctx, "application initialized, starting tasks ...")

	//
	// Start the task manager
	// All tasks can get access to appCtx by using app.From(ctx).
	//
	tasks.DefaultManager.Start(ctx)

	logger.Infof(ctx, "initialization complete")

	return appCtx, tracer, app.With(baseCtx, appCtx)
}

func setupAPI(app *app.App, grp *echo.Echo) {
	//
	// Configure the session manager
	//
	userProvider := session.UserProviderFunc(func(ctx context.Context, userId string) (*idmv1.Profile, error) {
		resp, err := app.IDM.UserServiceClient.GetUser(ctx, connect.NewRequest(&idmv1.GetUserRequest{
			Search: &idmv1.GetUserRequest_Id{
				Id: userId,
			},
		}))
		if err != nil {
			return nil, err
		}

		return resp.Msg.Profile, nil
	})

	apis := grp.Group(
		"/api/",
		session.Middleware(userProvider),
	)

	// alive check
	{
		apis.GET("", func(c echo.Context) error {
			return c.NoContent(http.StatusOK)
		})
	}
	// system APIs not designed to be consumed by users.
	// they are more for M2M communication
	{
		sys := apis.Group("_sys/")
		app.Tmpl2PDF.SetupAPI(sys.Group("pdf/"))
	}
	// API endpoints
	{
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
		// access to the statistics API
		statsapi.Setup(app, apis.Group("stats/"))
	}
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

	manager, err := importer.NewManager(ctx, runtime.GlobalSchema, app)
	if err != nil {
		logger.Fatalf(ctx, "importer: %s", err)
	}

	//
	// Register available importers
	//
	if err := vetinf.Register(ctx, manager); err != nil {
		logger.Fatalf(ctx, "failed to register vetinf importer: %s", err)
	}
	if err := carddav.Register(ctx, manager); err != nil {
		logger.Fatalf(ctx, "failed to register vetinf importer: %s", err)
	}

	//
	// Bootstrap triggers from existing configurations
	//
	if err := app.Trigger.LoadAndCreate(ctx); err != nil {
		logger.Errorf(ctx, "failed to boostrap trigger registry: %s", err)
	}

	//
	// Start the door scheduler
	//
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

	// We're ready now so fire the started event and start listening
	app.MarkReady(ctx)

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
