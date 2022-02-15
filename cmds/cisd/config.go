package main

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/pkg/svcenv"
	"github.com/tierklinik-dobersberg/logger"
)

// newLineReader returns an io.Reader that just emits a new line.
// This is required as not all .conf files in the ConfigurationDirectory
// may end in a new line and we need to avoid merging lines from different
// files.
func newLineReader() io.Reader {
	return strings.NewReader("\n")
}

func loadConfig(configSchema conf.SectionRegistry) (*conf.File, error) {
	env := svcenv.Env()

	// The configuration file is either located in env.ConfigurationDirectory
	// or in the current working-directory of the service.
	// TODO(ppacher): add support to disable the WD fallback.
	log := logger.From(context.TODO())

	dir := env.ConfigurationDirectory
	if dir == "" {
		var err error
		dir, err = os.Getwd()
		if err != nil {
			return nil, err
		}
	}
	log.V(5).Logf("configuration directory: %s", dir)

	// a list of io.Readers for each configuration file.
	var configurations []io.Reader
	mainConfigFile := filepath.Join(dir, "cis.conf")

	// if cfg.ConfigFileName does not include an extension
	// we default to .conf.
	if filepath.Ext(mainConfigFile) == "" {
		mainConfigFile = mainConfigFile + ".conf"
	}

	mainFile, err := os.Open(mainConfigFile)
	if err != nil {
		return nil, fmt.Errorf("failed to open: %w", err)
	}
	defer mainFile.Close()
	configurations = append(
		configurations,
		mainFile,
		newLineReader(),
	)

	// open all .conf files in the configuration-directory.
	confd := filepath.Join(dir, "conf.d")
	log.V(5).Logf("searching for additional .conf files in: %s", confd)
	matches, err := filepath.Glob(filepath.Join(confd, "*.conf"))
	if err != nil {
		// err can only be filepath.ErrBadPattern which we should never
		// see here. so time to panic
		panic(err)
	}

	sort.Strings(matches)
	for _, file := range matches {
		logger.From(context.TODO()).V(5).Logf("found configuration file: %s", file)
		f, err := os.Open(file)
		if err != nil {
			logger.Errorf(context.TODO(), "failed to open %s: %s, skipping", file, err)
			continue
		}
		defer f.Close()
		configurations = append(
			configurations,
			f,
			newLineReader(),
		)
	}

	log.V(5).Logf("loading service configuration from %d sources", int(len(configurations)/2))

	// finally deserialize all configuration files and convert it into a
	// conf.File. Actual decoding of confFile into a struct type happens
	// later.
	confFile, err := conf.Deserialize(mainConfigFile, io.MultiReader(configurations...))
	if err != nil {
		return nil, fmt.Errorf("failed to parse: %w", err)
	}

	// finally, create drop-ins from environment variables and apply them as well
	dropIn, err := conf.ParseFromEnv("CIS", os.Environ(), configSchema)
	if err != nil {
		return nil, fmt.Errorf("failed to parse environment variables into config: %w", err)
	}

	if dropIn != nil {
		if err := conf.ApplyDropIns(confFile, []*conf.DropIn{(*conf.DropIn)(dropIn)}, configSchema); err != nil {
			return nil, fmt.Errorf("failed to apply environment variables to config: %w", err)
		}
	}

	log.V(5).Logf("applied configuration values from environment: %+v", dropIn)

	// Validate the configuration file, set defaults and ensure
	// everything is ready to be parsed.
	if err := conf.ValidateFile(confFile, configSchema); err != nil {
		return nil, fmt.Errorf("invalid config file: %w", err)
	}

	return confFile, nil
}
