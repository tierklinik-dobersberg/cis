package loader

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/userhub/internal/crypt"
	"github.com/tierklinik-dobersberg/userhub/internal/schema"
)

// Listener defines a listener for the API server.
type Listener struct {
	Address     string
	TLSCertFile string
	TLSKeyFile  string
}

// Config defines the global configuration file.
type Config struct {
	Secret          string
	CookieName      string
	CookieDomain    string
	InsecureCookies bool
	AccessLogFile   string
	UserProperties  []conf.OptionSpec
	Listeners       []Listener
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

		if err := conf.ValidateFile(file, map[string][]conf.OptionSpec{
			"global":       schema.GlobalConfigSpec,
			"listener":     schema.ListenerSpec,
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
	global := globals[0]

	var err error
	cfg.CookieName, err = global.GetString("CookieName")
	if err != nil {
		return nil, fmt.Errorf("Global.CookieName: %w", err)
	}

	cfg.Secret, err = global.GetString("Secret")
	if conf.IsNotSet(err) {
		cfg.Secret, err = crypt.Nonce(32)
	}
	if err != nil {
		return nil, fmt.Errorf("Global.Secret: %w", err)
	}

	cfg.CookieDomain, err = global.GetString("CookieDomain")
	if err != nil {
		return nil, fmt.Errorf("Global.CookieDomain: %w", err)
	}

	cfg.InsecureCookies, err = global.GetBool("InsecureCookies")
	if err != nil {
		return nil, fmt.Errorf("Global.InsecureCookies: %w", err)
	}

	cfg.AccessLogFile, err = global.GetString("AccessLogFile")
	if err != nil && !conf.IsNotSet(err) {
		return nil, fmt.Errorf("Global.AccessLogFile: %w", err)
	}

	// build all specified listeners

	listeners := f.GetAll("listener")

	for idx, lsec := range listeners {
		listener, err := buildListener(lsec)
		if err != nil {
			return nil, fmt.Errorf("Listener #%d: %w", idx, err)
		}

		cfg.Listeners = append(cfg.Listeners, listener)
	}

	if len(cfg.Listeners) == 0 {
		cfg.Listeners = []Listener{
			{
				Address: "localhost:3000",
			},
		}
	}

	// get additional user propertie specs
	userProps := f.GetAll("userproperty")
	for idx, uprop := range userProps {
		spec, err := buildUserProperty(uprop)
		if err != nil {
			return nil, fmt.Errorf("UserProperty #%d: %w", idx, err)
		}

		cfg.UserProperties = append(cfg.UserProperties, spec)
	}

	return cfg, nil
}

func buildUserProperty(sec conf.Section) (c conf.OptionSpec, err error) {
	c.Name, err = sec.GetString("Name")
	if err != nil {
		return c, fmt.Errorf("Name: %w", err)
	}

	c.Description, err = sec.GetString("Description")
	if err != nil && !conf.IsNotSet(err) {
		return c, fmt.Errorf("Description: %w", err)
	}

	typeStr, err := sec.GetString("Type")
	if err != nil {
		return c, fmt.Errorf("Type: %w", err)
	}

	optType := conf.TypeFromString(typeStr)
	if optType == nil {
		return c, fmt.Errorf("Type: unknown type %s", typeStr)
	}
	c.Type = *optType

	c.Required, err = sec.GetBool("Required")
	if err != nil && !conf.IsNotSet(err) {
		return c, fmt.Errorf("Required: %w", err)
	}

	c.Default, err = sec.GetString("Default")
	if err != nil && !conf.IsNotSet(err) {
		return c, fmt.Errorf("Default: %w", err)
	}

	return c, nil
}

func buildListener(sec conf.Section) (Listener, error) {
	var (
		l   Listener
		err error
	)

	l.Address, err = sec.GetString("Address")
	if err != nil {
		return l, fmt.Errorf("Listener.Address: %w", err)
	}

	l.TLSCertFile, err = sec.GetString("CertificateFile")
	if err != nil && !conf.IsNotSet(err) {
		return l, fmt.Errorf("Listener.CertificateFile: %w", err)
	}

	l.TLSKeyFile, err = sec.GetString("PrivateKeyFile")
	if err != nil && !conf.IsNotSet(err) {
		return l, fmt.Errorf("Listener.PrivateKeyFile: %w", err)
	}

	return l, nil
}
