package main

import (
	"context"
	"embed"
	"io/fs"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strings"
	"time"

	goruntime "runtime"

	"github.com/bufbuild/connect-go"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	idmv1 "github.com/tierklinik-dobersberg/apis/gen/go/tkd/idm/v1"
	"github.com/tierklinik-dobersberg/cis/internal/api/configapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/doorapi"
	"github.com/tierklinik-dobersberg/cis/internal/api/openinghoursapi"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/cfgspec"
	"github.com/tierklinik-dobersberg/cis/internal/door"
	"github.com/tierklinik-dobersberg/cis/internal/openinghours"
	tracemw "github.com/tierklinik-dobersberg/cis/pkg/trace"
	"github.com/tierklinik-dobersberg/cis/runtime"
	"github.com/tierklinik-dobersberg/cis/runtime/configprovider/mongoprovider"
	"github.com/tierklinik-dobersberg/cis/runtime/session"
	"github.com/tierklinik-dobersberg/logger"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.opentelemetry.io/contrib/instrumentation/go.mongodb.org/mongo-driver/mongo/otelmongo"
	"go.opentelemetry.io/otel"
	tracesdk "go.opentelemetry.io/otel/sdk/trace"

	//
	// underscore imports that register themself somewhere.
	//

	// All available/build-in identity providers.
	"github.com/tierklinik-dobersberg/cis/internal/idm"
)

//go:embed ui
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
	cfg, _, err := loadConfig()
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
	databaseName := os.Getenv("MONGO_DATABASE")
	mongoClient := getMongoClient(ctx, os.Getenv("MONGO_URL"))
	runtime.GlobalSchema.SetProvider(mongoprovider.New(mongoClient, databaseName, "config"))

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
	doorController, err := door.NewDoorController(ctx, openingHoursCtrl, runtime.GlobalSchema)
	if err != nil {
		logger.Fatalf(ctx, "door-controler: %s", err.Error())
	}

	//
	// Create a new application context and make sure it's added
	// to each incoming HTTP Request.
	//
	appCtx := app.NewApp(
		cfg,
		doorController,
		holidayCache,
		os.Getenv("ROSTERD_SERVER"),
		idm.New(os.Getenv("IDM_URL"), http.DefaultClient),
	)

	ctx = app.With(baseCtx, appCtx)

	logger.Infof(ctx, "application initialized, starting tasks ...")

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

	// Static files
	staticPath := os.Getenv("STATIC_FILES")
	switch {
	case strings.HasPrefix(staticPath, "http"):
		u, err := url.Parse(staticPath)
		if err != nil {
			logrus.Fatal("invalid URL In STATIC_FILES")
		}

		grp.Any("/*", echo.WrapHandler(httputil.NewSingleHostReverseProxy(u)))

	case staticPath == "":
		webapp, err := fs.Sub(static, "ui")
		if err != nil {
			logger.Fatalf(context.Background(), err.Error())
		}

		grp.Use(middleware.StaticWithConfig(middleware.StaticConfig{
			Root:       "/",
			Index:      "index.html",
			HTML5:      true,
			Filesystem: http.FS(webapp),
		}))

	default:
		grp.Use(middleware.StaticWithConfig(middleware.StaticConfig{
			Root:  staticPath,
			Index: "index.html",
			HTML5: true,
		}))
	}

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

	// API endpoints
	{
		// doorapi provides access to the entry door controller.
		doorapi.Setup(app, apis.Group("door/", session.Require()))
		// configapi provides configuration specific endpoints.
		configapi.Setup(app, apis.Group("config/", session.Require()))
		// openinghoursapi provides access to the configured openinghours
		openinghoursapi.Setup(app, apis.Group("openinghours/", session.Require()))

		// grp.StaticFS("", webapp)
		// grp.FileFS("/*", "index.html", webapp)

		/*
			handler := spa.ServeSPA(http.FS(webapp), "index.html")
			grp.Any("", echo.WrapHandler(handler), func(next echo.HandlerFunc) echo.HandlerFunc {
				return func(c echo.Context) error {
					fmt.Printf("received request for %s\n", c.Request().URL.String())

					err := next(c)
					if err != nil {
						fmt.Printf("got error: %s\n", err)
					}

					return err
				}
			})
		*/
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

	if err := srv.Start(app.Config.Config.Listen); err != nil {
		logger.Fatalf(ctx, "failed to start listening: %s", err)
	}

	if err := app.Door.Stop(); err != nil {
		logger.Errorf(ctx, "failed to stop door scheduler: %s", err)
	}

	logger.Infof(ctx, "Service stopped successfully")
}
