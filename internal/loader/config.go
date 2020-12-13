package loader

import (
	"errors"
	"os"
	"path/filepath"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/service/server"
	"github.com/tierklinik-dobersberg/userhub/internal/schema"
)

// Config defines the global configuration file.
type Config struct {
	schema.GlobalConfig `section:"Global,required"`
	UserProperties      []conf.OptionSpec `section:"UserProperty"`
	Listeners           []server.Listener `section:"Listener"`
}

var globalConfigSpec = conf.FileSpec{
	"global":       schema.GlobalConfigSpec,
	"listener":     server.ListenerSpec,
	"userproperty": schema.UserSchemaExtension,
}

// LoadGlobalConfig loads and parses the global configuration file.
func (ldr *Loader) LoadGlobalConfig() (*Config, error) {
	searchPaths := make([]string, len(ldr.searchRoots))
	for idx, root := range ldr.searchRoots {
		searchPaths[len(ldr.searchRoots)-1-idx] = filepath.Join(root, "userhub.conf")
	}

	for _, path := range searchPaths {
		var cfg Config
		err := globalConfigSpec.ParseFile(path, &cfg)
		if errors.Is(err, os.ErrNotExist) {
			// try the next search path
			continue
		}

		if err != nil {
			// any other error should be returned to the caller.
			// It may be an invalid file, permission denied, ...
			// or any other error the user might need to take
			// care of.
			return nil, err
		}

		return &cfg, nil
	}

	return nil, os.ErrNotExist
}
