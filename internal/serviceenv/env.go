package serviceenv

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/tierklinik-dobersberg/logger"
)

var (
	getOnce sync.Once
	env     ServiceEnv
)

// ServiceEnv describes the environment used by the service.
type ServiceEnv struct {
	// ConfigurationDirectory holds the path to the
	// configuration directory of the server.
	ConfigurationDirectory string
	// StateDirectory holds the path to the directory
	// containing state data.
	StateDirectory string
	// RuntimeDirectory holds the path to the runtime
	// directory.
	RuntimeDirectory string
}

func (e *ServiceEnv) String() string {
	return fmt.Sprintf(
		"ConfigurationDirectory=%q StateDirectory=%q RuntimeDirectory=%q",
		e.ConfigurationDirectory,
		e.StateDirectory,
		e.RuntimeDirectory,
	)
}

// Env returns the current server environment
func Env() ServiceEnv {
	getOnce.Do(loadEnv)
	return env
}

func loadEnv() {
	wd, err := os.Getwd()
	if err != nil {
		logger.DefaultLogger().Errorf("failed to get current working directory: %s", err.Error())
		wd = "."
	}
	wd = filepath.Clean(wd)

	e := ServiceEnv{
		ConfigurationDirectory: filepath.Join(wd, "userhub", "config"),
		StateDirectory:         filepath.Join(wd, "userhub", "state"),
		RuntimeDirectory:       filepath.Join(os.TempDir(), "userhub"),
	}

	// Get configuration from environment variables managed by systemd
	if configDir := os.Getenv("CONFIGURATION_DIRECTORY"); configDir != "" {
		e.ConfigurationDirectory = filepath.Clean(configDir)
	}
	if stateDir := os.Getenv("STATE_DIRECTORY"); stateDir != "" {
		e.StateDirectory = filepath.Clean(stateDir)
	}
	if runDir := os.Getenv("RUNTIME_DIRECTORY"); runDir != "" {
		e.RuntimeDirectory = runDir
	}

	env = e
}
