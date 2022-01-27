package file

import (
	"context"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/identity"
	"github.com/tierklinik-dobersberg/service/runtime"
)

func Factory(ctx context.Context, _ conf.Section, env identity.Environment) (identity.Provider, error) {
	return New(ctx, env.ConfigurationDirectory, env.Global.Country, env.UserPropertyDefinitions)
}

func init() {
	runtime.Must(
		identity.DefaultRegistry.Register("file", nil, identity.FactoryFunc(Factory)),
	)
}

// compile time check since we support setting passwords
var _ identity.PasswortChangeSupport = new(identDB)
