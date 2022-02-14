package service

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

// Boot boots the service and returns the service
// instance.
func Boot(cfg Config) (*Instance, error) {
	// setup logging
	log := new(logAdapter)
	log.setMaxSeverity(cfg.LogLevel)
	if cfg.UseStdlibLogAdapter {
		log.addAdapter(new(logger.StdlibAdapter))
	}

	logger.SetDefaultAdapter(log)

	// load the service environment
	env := svcenv.Env()

	// load the configuration file
	cfgFile, err := loadConfig(env, &cfg)
	if err != nil {
		return nil, fmt.Errorf("configuration: %w", err)
	}

	// If there's a receiver target for the configuration
	// directly decode it there.
	if cfg.ConfigTarget != nil {
		if err := conf.DecodeFile(cfgFile, cfg.ConfigTarget, cfg.ConfigSchema); err != nil {
			return nil, fmt.Errorf("failed to decode config: %w", err)
		}
	}

	inst := &Instance{
		Config:     cfg,
		ServiceEnv: env,
		cfgFile:    cfgFile,
		logAdapter: log,
	}

	return inst, nil
}

// newLineReader returns an io.Reader that just emits a new line.
// This is required as not all .conf files in the ConfigurationDirectory
// may end in a new line and we need to avoid merging lines from different
// files.
func newLineReader() io.Reader {
	return strings.NewReader("\n")
}

func loadConfig(env svcenv.ServiceEnv, cfg *Config) (*conf.File, error) {
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
	fpath := filepath.Join(dir, cfg.ConfigFileName)
	if cfg.ConfigFileName != "" {
		// if cfg.ConfigFileName does not include an extension
		// we default to .conf.
		if filepath.Ext(fpath) == "" {
			fpath = fpath + ".conf"
		}
		// TODO(ppacher): should the existance of the main configuration
		// file be optional?
		log.V(5).Logf("trying to load main config file from: %s", fpath)
		mainFile, err := os.Open(fpath)
		if err != nil {
			return nil, fmt.Errorf("failed to open: %w", err)
		}
		defer mainFile.Close()
		configurations = append(
			configurations,
			mainFile,
			newLineReader(),
		)
	}

	// open all .conf files in the configuration-directory.
	if confd := cfg.ConfigDirectory; confd != "" {
		// TODO(ppacher): should we check if that directory actually
		// exists?
		if !filepath.IsAbs(confd) {
			confd = filepath.Join(dir, confd)
		}
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
	} else {
		log.V(5).Logf("no conf.d directory configured, not scanning for additional files ...")
	}

	log.V(5).Logf("loading service configuration from %d sources", int(len(configurations)/2))

	// finally deserialize all configuration files and convert it into a
	// conf.File. Actual decoding of confFile into a struct type happens
	// later.
	confFile, err := conf.Deserialize(fpath, io.MultiReader(configurations...))
	if err != nil {
		return nil, fmt.Errorf("failed to parse: %w", err)
	}

	// Validate the configuration file, set defaults and ensure
	// everything is ready to be parsed.
	if err := conf.ValidateFile(confFile, cfg); err != nil {
		return nil, fmt.Errorf("invalid config file: %w", err)
	}

	return confFile, nil
}
