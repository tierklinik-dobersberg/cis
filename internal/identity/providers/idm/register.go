package idm

import (
	"context"
	"fmt"
	"os"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/identity"
	"github.com/tierklinik-dobersberg/cis/runtime"
)

func init() {
	runtime.Must(
		identity.DefaultRegistry.Register("idm", nil, identity.FactoryFunc(
			func(ctx context.Context, cfg conf.Section, env identity.Environment) (identity.Provider, error) {
				idmurl := os.Getenv("IDM_URL")
				if idmurl == "" {
					return nil, fmt.Errorf("IDM_URL not configured")
				}

				return New(idmurl, nil), nil
			},
		)),
	)
}
