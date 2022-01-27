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
	"github.com/tierklinik-dobersberg/service/server"
)

func setupServer(ctx context.Context, app *app.App) (*echo.Echo, error) {
	engine := echo.New()

	engine.Use(
		middleware.Logger(),
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

func convertToCorsConfig(c *server.CORS) (middleware.CORSConfig, error) {
	t, err := time.ParseDuration(c.MaxAge)
	if err != nil {
		return middleware.DefaultCORSConfig, err
	}
	if len(c.AllowMethods) == 0 {
		c.AllowMethods = []string{http.MethodGet, http.MethodHead, http.MethodPut, http.MethodPatch, http.MethodPost, http.MethodDelete}
	}
	if len(c.AllowOrigins) == 0 {
		c.AllowOrigins = []string{"*"}
	}
	return middleware.CORSConfig{
		Skipper:          middleware.DefaultSkipper,
		AllowOrigins:     c.AllowOrigins,
		AllowMethods:     c.AllowMethods,
		AllowHeaders:     c.AllowHeaders,
		AllowCredentials: c.AllowCredentials,
		ExposeHeaders:    c.ExposeHeaders,
		MaxAge:           int(t / time.Second),
	}, nil
}
