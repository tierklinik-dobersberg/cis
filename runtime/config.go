package runtime

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/pkg/confutil"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

type (
	// ConfigSchema defines the allowed sections for a configuration
	// file.
	ConfigSchema struct {
		rw         sync.RWMutex
		entries    map[string]Schema
		validators map[string][]Validator
		listeners  map[string][]ChangeListener

		providerLock sync.RWMutex
		provider     ConfigProvider
	}

	// ConfigSchemaBuilder collects functions that add configuration
	// sections to a configuration scheme. It's to allow code to be used
	// with multiple configuration schemes while still being allowed to
	// register on the global configuration.
	ConfigSchemaBuilder []func(*ConfigSchema) error

	// ConfigTest can be added to Schema to support testing a
	// configuration before is stored in the backend.
	ConfigTest struct {
		// ID is a unique ID for this configuration test and used to identify
		// and trigger the test.
		ID string `json:"id"`

		// Name holds a human readable name of the test and is used when the user
		// can select between available config tests.
		Name string `json:"name"`

		// Spec defines a set of options that the user can or must provide in order to
		// test a configuration schema.
		Spec conf.OptionRegistry `json:"spec"`

		// TestFunc is called to verify that config works as expected. config adheres to the
		// schema specification. testSpec is the configuration to execute the test and may hold
		// additional data like the receiver of a test notification.
		TestFunc func(ctx context.Context, config []conf.Option, testSpec []conf.Option) (*TestResult, error) `json:"-"`
	}

	TestResult struct {
		Error   string `json:"error"`
		Message string `json:"message,omitempty"`
	}

	// Schema is passed to ConfigSchema.Register and holds metadata and information
	// about the registered configuration block.
	Schema struct {
		// Name is the name of the registration block and is used to identify the allowed
		// values of a configuration.
		// Name is required when registering a new configuration block.
		Name string `json:"name"`

		// DisplayName holds a human readable name for the schema type and is mainly used
		// in the user interface. If omitted, DisplayName is set to equal Name.
		DisplayName string `json:"displayName"`

		// SVGData may hold an icon definition that may be rendered in a <svg> tag
		// in a user interface.
		SVGData string `json:"svgData,omitempty"`

		// Description holds a human readable description of the configuration block and
		// is mainly used by the user interface.
		// Description is optional.
		Description string `json:"description"`

		// Category defines the category the configuration section belongs to.
		// Categories can be used to group related sections together in the user
		// interface.
		Category string `json:"category"`

		// Spec holds the actual section registry that defines which sections, values and
		// which types are allowed for instances of the configuration block.
		// Spec is required when registering a new configuration block.
		Spec conf.OptionRegistry `json:"-"`

		// Multi should be set to true if multiple instances of the registered
		// configuration can exist at the same time.
		Multi bool `json:"multi"`

		// Internal can be set to true if the schema should not be exposed via
		// the REST API.
		Internal bool `json:"internal"`

		// Annotations may hold additional annotations about the configuration schema. Those
		// annotations may be, for example, used by user interfaces to determine how to
		// best display the configuration setting.
		Annotations conf.Annotation `json:"annotation"`

		// Tests may hold one or more configuration test that a user may perform in order to
		// be certain that a configuration schema works as expected.
		Tests []ConfigTest `json:"tests,omitempty"`
	}

	Validator interface {
		// Validate can be set if if the configuration section must be externally validated
		// before being created or updated.
		// The parameter id is only set in case of an update. Users should be aware that
		// even if ValidateFunc returns a nil-error the section might fail to be saved successfully.
		// Users should use a ChangeListener callback instead.
		Validate(ctx context.Context, sec Section) error
	}

	ChangeListener interface {
		// NotifyChange is called when an instance of a specific configuration section
		// is created, modified or deleted. The changeType parameter will be set to
		// "create", "update" or "delete" respectively with id holding a unique identifier
		// for the section. Note that sec is only set for create or update operations but MAY
		// be omitted during deletes.
		// Note that any error returned from this callback is displayed to the user but does
		// NOT prevent that change from happening!
		NotifyChange(ctx context.Context, changeType, id string, sec *conf.Section) error
	}
)

var (
	ChangeTypeCreate = "create"
	ChangeTypeUpdate = "update"
	ChangeTypeDelete = "delete"
)

func NewTestError(err error) *TestResult {
	return &TestResult{
		Error: err.Error(),
	}
}

// NewConfigSchemaBuilder returns a new config schema builder using funcs.
func NewConfigSchemaBuilder(funcs ...func(s *ConfigSchema) error) ConfigSchemaBuilder {
	var csb ConfigSchemaBuilder

	csb.Register(funcs...)

	return csb
}

// Register adds a config schema setup function to the list.
func (csb *ConfigSchemaBuilder) Register(funcs ...func(*ConfigSchema) error) {
	for _, f := range funcs {
		*csb = append(*csb, f)
	}
}

// AddToSchema applies all functions from csb to scheme. It aborts if non-nil
// error is returned.
func (csb *ConfigSchemaBuilder) AddToSchema(scheme *ConfigSchema) error {
	for _, f := range *csb {
		if err := f(scheme); err != nil {
			return err
		}
	}

	return nil
}

var (
	ErrMissingName = errors.New("config-schema: registration is missing a unique name")
	ErrNameTaken   = errors.New("config-schema: registration name already in use")
	ErrMissingSpec = errors.New("config-schema: registration is missing configuration specification")
)

// Register registers a section at the global config registry.
func (schema *ConfigSchema) Register(regs ...Schema) error {
	schema.rw.Lock()
	defer schema.rw.Unlock()

	for idx, reg := range regs {
		if reg.Name == "" {
			return fmt.Errorf("index %d: %w", idx, ErrMissingName)
		}
		lowerName := strings.ToLower(reg.Name)

		if reg.DisplayName == "" {
			reg.DisplayName = reg.Name
		}

		if reg.Spec == nil {
			return fmt.Errorf("%s: %w", reg.Name, ErrMissingSpec)
		}

		if _, ok := schema.entries[lowerName]; ok {
			return fmt.Errorf("%s: %w", reg.Name, ErrNameTaken)
		}

		if schema.entries == nil {
			schema.entries = make(map[string]Schema)
		}
		schema.entries[lowerName] = reg
	}

	return nil
}

func (schema *ConfigSchema) AddNotifier(listener ChangeListener, types ...string) {
	schema.rw.Lock()
	defer schema.rw.Unlock()

	if schema.listeners == nil {
		schema.listeners = map[string][]ChangeListener{}
	}
	for _, t := range types {
		t = strings.ToLower(t)
		schema.listeners[t] = append(schema.listeners[t], listener)
	}
}

func (schema *ConfigSchema) AddValidator(validator Validator, types ...string) {
	schema.rw.Lock()
	defer schema.rw.Unlock()

	if schema.validators == nil {
		schema.validators = map[string][]Validator{}
	}
	for _, t := range types {
		t = strings.ToLower(t)
		schema.validators[t] = append(schema.validators[t], validator)
	}
}

// FileSpec returns the current file spec described by the config schema.
func (schema *ConfigSchema) FileSpec() conf.FileSpec {
	schema.rw.RLock()
	defer schema.rw.RUnlock()

	c := conf.FileSpec{}
	for sec, spec := range schema.entries {
		c[sec] = spec.Spec
	}

	return c
}

// Schemas returns a slice of all registered configuration schemas.
func (schema *ConfigSchema) Schemas() []Schema {
	schema.rw.RLock()
	defer schema.rw.RUnlock()

	res := make([]Schema, 0, len(schema.entries))
	for _, value := range schema.entries {
		res = append(res, value)
	}

	sort.Sort(schemaByName(res))

	return res
}

// SchemaByName returns the schema definition by name.
func (schema *ConfigSchema) SchemaByName(name string) (Schema, error) {
	schema.rw.RLock()
	defer schema.rw.RUnlock()

	s, ok := schema.entries[strings.ToLower(name)]
	if ok {
		return s, nil
	}

	return Schema{}, ErrUnknownType
}

func (schema *ConfigSchema) SchemaAsMap(ctx context.Context, name string, withDefaults bool) (map[string]map[string]interface{}, error) {
	lower := strings.ToLower(name)
	spec, ok := schema.entries[lower]
	if !ok {
		return nil, ErrCfgSectionNotFound
	}

	schema.providerLock.RLock()
	defer schema.providerLock.RUnlock()

	if schema.provider == nil {
		return nil, ErrNoProvider
	}

	configs, err := schema.provider.Get(ctx, name)
	if err != nil {
		return nil, err
	}

	if withDefaults {
		for _, opt := range spec.Spec.All() {
			for idx, sec := range configs {
				found := false
				for _, setOpt := range sec.Options {
					if strings.EqualFold(setOpt.Name, opt.Name) {
						found = true

						break
					}
				}

				if !found && opt.Default != "" {
					sec.Options = append(sec.Options, conf.Option{
						Name:  opt.Name,
						Value: opt.Default,
					})

					configs[idx] = sec
				}
			}
		}
	}

	decoder := conf.NewSectionDecoder(spec.Spec.All())
	result := make(map[string]map[string]interface{}, len(configs))
	for _, sec := range configs {
		result[sec.ID] = decoder.AsMap(sec.Section)
	}

	return result, nil
}

// OptionsForSection implements conf.SectionRegistry.
func (schema *ConfigSchema) OptionsForSection(name string) (conf.OptionRegistry, bool) {
	schema.rw.RLock()
	defer schema.rw.RUnlock()

	if schema.entries == nil {
		return nil, false
	}

	lower := strings.ToLower(name)
	reg, ok := schema.entries[lower]
	if !ok {
		return nil, false
	}

	return reg.Spec, true
}

// DecodeSection decodes the values of section from into target.
func (schema *ConfigSchema) DecodeSection(ctx context.Context, section string, target interface{}) error {
	schema.providerLock.RLock()
	defer schema.providerLock.RUnlock()

	if schema.provider == nil {
		return ErrNoProvider
	}

	spec, ok := schema.OptionsForSection(section)
	if !ok {
		return conf.ErrUnknownSection
	}

	sections, err := schema.provider.Get(ctx, section)
	if err != nil {
		return err
	}
	s := make([]conf.Section, len(sections))
	for idx, sec := range sections {
		s[idx] = sec.Section
		s[idx].Options = append(s[idx].Options,
			conf.Option{
				Name:  "_id",
				Value: sec.ID,
			},
		)
	}

	// add the spec for the "virtual _id" field.
	spec = confutil.MultiOptionRegistry{
		spec,
		conf.SectionSpec{
			{
				Name: "_id",
				Type: conf.StringType,
			},
		},
	}

	return conf.DecodeSections(s, spec, target)
}

// SetProvider sets the parsed configuration file for the schema.
func (schema *ConfigSchema) SetProvider(provider ConfigProvider) {
	schema.providerLock.Lock()
	defer schema.providerLock.Unlock()

	schema.provider = provider
}

func (schema *ConfigSchema) GetID(ctx context.Context, id string) (Section, error) {
	ctx, sp := otel.Tracer("").Start(ctx, "runtime.ConfigSchema.GetID",
		trace.WithAttributes(
			attribute.String("schema_instance_id", id),
		),
	)
	defer sp.End()

	schema.providerLock.RLock()
	defer schema.providerLock.RUnlock()

	if schema.provider == nil {
		return Section{}, ErrNoProvider
	}

	sec, err := schema.provider.GetID(ctx, id)

	return sec, err
}

func (schema *ConfigSchema) All(ctx context.Context, secType string) ([]Section, error) {
	ctx, sp := otel.Tracer("").Start(ctx, "runtime.ConfigSchema.All",
		trace.WithAttributes(
			attribute.String("schema_type", secType),
		),
	)
	defer sp.End()

	schema.providerLock.RLock()
	defer schema.providerLock.RUnlock()

	if schema.provider == nil {
		return nil, ErrNoProvider
	}

	return schema.provider.Get(ctx, secType)
}

func (schema *ConfigSchema) Create(ctx context.Context, secType string, options []conf.Option) (string, error) {
	ctx, sp := otel.Tracer("").Start(ctx, "runtime.ConfigSchema.Create",
		trace.WithAttributes(
			attribute.String("schema_type", secType),
		),
	)
	defer sp.End()

	schema.rw.RLock()
	defer schema.rw.RUnlock()

	schema.providerLock.RLock()
	defer schema.providerLock.RUnlock()

	if schema.provider == nil {
		return "", ErrNoProvider
	}

	reg, ok := schema.entries[strings.ToLower(secType)]
	if !ok {
		return "", ErrCfgSectionNotFound
	}

	// ensure spec compliance
	if err := conf.ValidateOptions(options, reg.Spec); err != nil {
		return "", httperr.BadRequest(err.Error())
	}

	if err := schema.ensureUniquness(ctx, reg, options, ""); err != nil {
		return "", err
	}

	sec := conf.Section{
		Name:    secType,
		Options: options,
	}

	if err := schema.runValidators(ctx, Section{Section: sec}); err != nil {
		return "", err
	}

	instanceID, err := schema.provider.Create(ctx, sec)
	if err != nil {
		return "", err
	}

	err = schema.notifyChangeListeners(ctx, ChangeTypeCreate, instanceID, sec.Name, &sec)

	return instanceID, err
}

func (schema *ConfigSchema) Update(ctx context.Context, id, secType string, opts []conf.Option) error {
	ctx, sp := otel.Tracer("").Start(ctx, "runtime.ConfigSchema.Update",
		trace.WithAttributes(
			attribute.String("schema_instance_id", id),
			attribute.String("schema_type", secType),
		),
	)
	defer sp.End()

	schema.providerLock.RLock()
	defer schema.providerLock.RUnlock()

	schema.rw.RLock()
	defer schema.rw.RUnlock()

	if schema.provider == nil {
		return ErrNoProvider
	}

	reg, ok := schema.entries[strings.ToLower(secType)]
	if !ok {
		return ErrCfgSectionNotFound
	}

	opts = filterPrivateID(opts)

	// ensure spec compliance
	if err := conf.ValidateOptions(opts, reg.Spec); err != nil {
		return httperr.BadRequest(err.Error())
	}

	if err := schema.ensureUniquness(ctx, reg, opts, id); err != nil {
		return err
	}

	sec := Section{
		ID: id,
		Section: conf.Section{
			Name:    secType,
			Options: opts,
		},
	}

	if err := schema.runValidators(ctx, sec); err != nil {
		return err
	}

	if err := schema.provider.Update(ctx, id, secType, opts); err != nil {
		return err
	}

	if err := schema.notifyChangeListeners(ctx, ChangeTypeUpdate, id, secType, &sec.Section); err != nil {
		return err
	}

	return nil
}

func (schema *ConfigSchema) Delete(ctx context.Context, id string) error {
	ctx, sp := otel.Tracer("").Start(ctx, "runtime.ConfigSchema.Delete",
		trace.WithAttributes(
			attribute.String("schema_instance_id", id),
		),
	)
	defer sp.End()

	schema.providerLock.RLock()
	defer schema.providerLock.RUnlock()

	if schema.provider == nil {
		return ErrNoProvider
	}

	value, err := schema.provider.GetID(ctx, id)
	if err != nil {
		return err
	}

	schema.rw.RLock()
	defer schema.rw.RUnlock()

	if err := schema.provider.Delete(ctx, id); err != nil {
		return err
	}

	if err := schema.notifyChangeListeners(ctx, ChangeTypeDelete, id, value.Name, nil); err != nil {
		return err
	}

	return nil
}

// Test validates configSpec using the defined configuration test testID. testSpec holds configuration
// values required for the test as defined in ConfigTest.Spec.
// Test automatically applies defaults for configSpec and testSpec and validates them against the
// respective configuration specification.
func (schema *ConfigSchema) Test(ctx context.Context, schemaType, testID string, configSpec, testSpec []conf.Option) (*TestResult, error) {
	s, tester, err := schema.getTest(ctx, schemaType, testID)
	if err != nil {
		return nil, err
	}

	// TODO(ppacher): should we call schema.ValidateFunc here as wel?
	confSec, err := conf.Prepare(conf.Section{
		Name:    schemaType,
		Options: configSpec,
	}, s.Spec)
	if err != nil {
		return nil, httperr.BadRequest(err.Error())
	}

	testSec, err := conf.Prepare(conf.Section{
		Name:    "Test",
		Options: testSpec,
	}, tester.Spec)
	if err != nil {
		return nil, httperr.BadRequest(err.Error())
	}

	ctx, cancel := context.WithTimeout(ctx, time.Minute*2)
	defer cancel()

	return tester.TestFunc(ctx, confSec.Options, testSec.Options)
}

func (schema *ConfigSchema) getTest(_ context.Context, schemaType, testID string) (Schema, ConfigTest, error) {
	schema.rw.RLock()
	defer schema.rw.RUnlock()

	entry, ok := schema.entries[strings.ToLower(schemaType)]
	if !ok {
		return Schema{}, ConfigTest{}, ErrCfgSectionNotFound
	}

	var test *ConfigTest
	for _, t := range entry.Tests {
		if t.ID == testID {
			// trunk-ignore(golangci-lint/gosec)
			test = &t

			break
		}
	}

	if test == nil {
		return entry, ConfigTest{}, ErrUnknownConfigTest
	}

	return entry, *test, nil
}

func (schema *ConfigSchema) runValidators(ctx context.Context, sec Section) error {
	var errs []error
	for _, validator := range schema.validators[""] {
		if err := validator.Validate(ctx, sec); err != nil {
			errs = append(errs, err)
		}
	}
	for _, validator := range schema.validators[strings.ToLower(sec.Name)] {
		if err := validator.Validate(ctx, sec); err != nil {
			errs = append(errs, err)
		}
	}

	if err := errors.Join(errs...); err != nil {
		return httperr.BadRequest(err.Error())
	}

	return nil
}

func (schema *ConfigSchema) notifyChangeListeners(ctx context.Context, changeType, id string, secName string, sec *conf.Section) error {
	ctx, sp := otel.Tracer("").Start(ctx, "runtime.ConfigSchema.notifyChangeListeners",
		trace.WithAttributes(
			attribute.String("change_type", changeType),
		),
	)
	defer sp.End()

	var errs []error
	for _, listener := range schema.listeners[""] {
		if err := listener.NotifyChange(ctx, changeType, id, sec); err != nil {
			errs = append(errs, err)
		}
	}
	for _, listener := range schema.listeners[strings.ToLower(secName)] {
		if err := listener.NotifyChange(ctx, changeType, id, sec); err != nil {
			errs = append(errs, err)
		}
	}

	if err := errors.Join(errs...); err != nil {
		return &NotificationError{Wrapped: err}
	}

	return nil
}

func (schema *ConfigSchema) ensureUniquness(ctx context.Context, reg Schema, sec conf.Options, self string) error {
	uniqueFields, ok := reg.Annotations.Get("vet.dobersberg.cis:schema/unqiueFields").([]string)
	if !ok {
		return nil
	}

	all, err := schema.All(ctx, reg.Name)
	if err != nil {
		return err
	}

	for _, f := range uniqueFields {
		newValues := sec.GetStringSlice(f)

		for _, instance := range all {
			if instance.ID == self {
				continue
			}

			if match, ok := optionIncludesValues(instance.Options, f, newValues); ok {
				return fmt.Errorf("field %q=%q already used in instance %s", f, match, instance.ID)
			}
		}
	}

	return nil
}

func filterPrivateID(opts []conf.Option) []conf.Option {
	res := make([]conf.Option, 0, len(opts))
	for _, opt := range opts {
		if opt.Name != "_id" {
			res = append(res, opt)
		}
	}

	return res
}

func optionIncludesValues(opts conf.Options, optionName string, values []string) (string, bool) {
	lm := make(map[string]struct{}, len(values))
	for _, f := range values {
		lm[f] = struct{}{}
	}
	for _, v := range opts.GetStringSlice(optionName) {
		if _, ok := lm[v]; ok {
			return v, true
		}
	}

	return "", false
}

// GlobalSchema is the global configuration schema.
var GlobalSchema = new(ConfigSchema)

// Sorting schemas by name.
type schemaByName []Schema

func (sn schemaByName) Len() int           { return len(sn) }
func (sn schemaByName) Less(i, j int) bool { return sn[i].Name < sn[j].Name }
func (sn schemaByName) Swap(i, j int)      { sn[i], sn[j] = sn[j], sn[i] }
