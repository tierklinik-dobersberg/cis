package main

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/tierklinik-dobersberg/apis/pkg/spa"
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
			_, network, err := net.ParseCIDR(r)
			if err != nil {
				// try to parse a hostname
				ips, err := net.LookupIP(r)
				if err != nil {
					return nil, fmt.Errorf("failed to parse %s: %w", network, err)
				}

				for _, ip := range ips {
					trusts = append(trusts, echo.TrustIPRange(&net.IPNet{
						IP:   ip,
						Mask: net.CIDRMask(net.IPv6len*8, net.IPv6len*8),
					}))
				}
			} else {
				trusts = append(trusts, echo.TrustIPRange(network))
			}
		}

		engine.IPExtractor = echo.ExtractIPFromXFFHeader(trusts...)
	}

	handler := spa.ServeSPA(http.FS(static), "index.html")
	engine.Any("/", echo.WrapHandler(handler))

	return engine, nil
}

func convertToCorsConfig(corsConfig *app.CORS) (middleware.CORSConfig, error) {
	maxAge, err := time.ParseDuration(corsConfig.MaxAge)
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
		MaxAge:           int(maxAge / time.Second),
	}, nil
}
