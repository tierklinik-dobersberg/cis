package loader

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/service/server"
	"github.com/tierklinik-dobersberg/userhub/internal/schema"
)

// Config defines the global configuration file.
type Config struct {
	schema.GlobalConfig

	UserProperties []conf.OptionSpec
	Listeners      []conf.Section
}

// LoadGlobalConfig loads and parses the global configuration file.
func (ldr *Loader) LoadGlobalConfig() (*Config, error) {
	searchPaths := make([]string, len(ldr.searchRoots))
	for idx, root := range ldr.searchRoots {
		searchPaths[len(ldr.searchRoots)-1-idx] = filepath.Join(root, "userhub.conf")
	}

	for _, path := range searchPaths {
		f, err := os.Open(path)
		if err != nil {
			continue
		}
		defer f.Close()

		file, err := conf.Deserialize(path, f)
		if err != nil {
			return nil, err
		}

		if err := conf.ValidateFile(file, conf.FileSpec{
			"global":       schema.GlobalConfigSpec,
			"listener":     server.ListenerSpec,
			"userproperty": schema.UserSchemaExtension,
		}); err != nil {
			return nil, err
		}

		return buildConfig(file)
	}

	return nil, os.ErrNotExist
}

func buildConfig(f *conf.File) (*Config, error) {
	cfg := new(Config)

	globals := f.GetAll("global")
	if len(globals) != 1 {
		return nil, fmt.Errorf("[Global] can only be specified once")
	}

	var err error
	cfg.GlobalConfig, err = schema.BuildGlobalConfig(globals[0])
	if err != nil {
		return nil, fmt.Errorf("Global: %w", err)
	}

	// build all specified listeners
	cfg.Listeners = f.GetAll("listener")

	// get additional user propertie specs
	userProps := f.GetAll("userproperty")
	for idx, uprop := range userProps {
		spec, err := schema.BuildUserPropertySpec(uprop)
		if err != nil {
			return nil, fmt.Errorf("UserProperty #%d: %w", idx, err)
		}

		cfg.UserProperties = append(cfg.UserProperties, spec)
	}

	return cfg, nil
}
