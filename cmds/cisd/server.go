package main

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/tierklinik-dobersberg/cis/internal/app"
)

func setupServer(ctx context.Context, app *app.App) (*echo.Echo, error) {
	engine := echo.New()

	engine.Use(
		middleware.LoggerWithConfig(middleware.LoggerConfig{
			Skipper: func(c echo.Context) bool {
				// skip the health-check endpoint because it creates a lot of traces
				// but does not provide any real value ...
				return c.Path() == "/api/"
			},
		}),
		middleware.Recover(),
	)

	engine.Server.BaseContext = func(l net.Listener) context.Context {
		return ctx
	}

	corsConfig, err := convertToCorsConfig(&app.Config.CORS)
	if err != nil {
		return nil, fmt.Errorf("failed to convert CORS config: %w", err)
	}

	engine.Use(middleware.CORSWithConfig(corsConfig))

	if len(app.Config.TrustedProxy) > 0 {
		trusts := []echo.TrustOption{
			echo.TrustLinkLocal(false),
		}

		for _, r := range app.Config.TrustedProxy {
			_, n, err := net.ParseCIDR(r)
			if err != nil {
				return nil, fmt.Errorf("failed to parse %s: %w", n, err)
			}
			trusts = append(trusts, echo.TrustIPRange(n))
		}

		engine.IPExtractor = echo.ExtractIPFromXFFHeader(trusts...)
	}

	return engine, nil
}

func convertToCorsConfig(corsConfig *app.CORS) (middleware.CORSConfig, error) {
	t, err := time.ParseDuration(corsConfig.MaxAge)
	if err != nil {
		return middleware.DefaultCORSConfig, err
	}
	if len(corsConfig.AllowMethods) == 0 {
		corsConfig.AllowMethods = []string{http.MethodGet, http.MethodHead, http.MethodPut, http.MethodPatch, http.MethodPost, http.MethodDelete}
	}
	if len(corsConfig.AllowOrigins) == 0 {
		corsConfig.AllowOrigins = []string{"*"}
	}
	return middleware.CORSConfig{
		Skipper:          middleware.DefaultSkipper,
		AllowOrigins:     corsConfig.AllowOrigins,
		AllowMethods:     corsConfig.AllowMethods,
		AllowHeaders:     corsConfig.AllowHeaders,
		AllowCredentials: corsConfig.AllowCredentials,
		ExposeHeaders:    corsConfig.ExposeHeaders,
		MaxAge:           int(t / time.Second),
	}, nil
}
