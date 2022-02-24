package runtime

import (
	"context"
	"errors"

	"github.com/ppacher/system-conf/conf"
)

// Common errors when working with ConfigProvider.
var (
	ErrNoProvider         = errors.New("config-provider: not initialized")
	ErrCfgSectionNotFound = errors.New("config-provider: no configuration section found")
	ErrReadOnly           = errors.New("config-provider: provider is read-only")
	ErrUnknownConfigTest  = errors.New("config: unknown configuration tests identifier")
	ErrUnknownType        = errors.New("config: unknown-type")
)

type NotificationError struct {
	Wrapped error
}

func (nf *NotificationError) Error() string {
	return nf.Wrapped.Error()
}

func (nf *NotificationError) Unwrap() error {
	return nf.Wrapped
}

type Section struct {
	ID string
	conf.Section
}

// Decode is a shortcut for using conf.DecodeSections with sec only.
func (sec Section) Decode(spec conf.OptionRegistry, target interface{}) error {
	return conf.DecodeSections([]conf.Section{sec.Section}, spec, target)
}

// ConfigProvider is used by ConfigSchema to provide access to configuration
// values abstracting a way the actual storage and format of configuration
// data.
type ConfigProvider interface {
	// Create should store a new configuration section and return a unique
	// ID for that section.
	Create(ctx context.Context, sec conf.Section) (id string, err error)

	// Update should update an existing configuration section by id. opts
	// holds the new configuration data for that section.
	Update(ctx context.Context, id string, secType string, opts []conf.Option) error

	// Delete should delete an existing configuration section by id.
	Delete(ctx context.Context, id string) error

	// Get returns all options for the given sectionType.
	Get(ctx context.Context, sectionType string) ([]Section, error)

	// GetID returns the section by ID.
	GetID(ctx context.Context, id string) (Section, error)
}
