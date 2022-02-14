package mongo

import (
	"context"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/identity"
	"github.com/tierklinik-dobersberg/cis/runtime"
)

func init() {
	runtime.Must(
		identity.DefaultRegistry.Register(
			"mongo",
			nil,
			identity.FactoryFunc(func(ctx context.Context, cfg conf.Section, env identity.Environment) (identity.Provider, error) {
				return New(ctx, env)
			},
			),
		),
	)
}
