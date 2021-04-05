package httpcond

import (
	"errors"
	"net/http"
	"strings"
	"sync"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/pkglog"
)

var log = pkglog.New("httpcond")

// MatchFunc is the func that validates if a request fullfills
// a condition. Its passed the incoming HTTP request and the
// conditions value. MatchFunc should not care about negating
// or otherwise complex boolean logic (AND/OR) as this is
// handled by the condition chain itself.
type MatchFunc func(req *http.Request, value string) (bool, error)

// Condition descibes the interface that is used to evaluate if a
// HTTP request matches a condition.
type Condition interface {
	Match(req *http.Request) (bool, error)
}

// ConcatFunc decides how multiple conditions (of the same type)
// are used together.
type ConcatFunc func(...Condition) Condition

// Type describes a condition that may be fullfilled by a HTTP request.
type Type struct {
	// Name holds the name of the condition. The name is also
	// used to build the configuration stanza that is used for
	// this condition.
	Name string
	// Description is a description of the condition.
	Description string
	// Type defaults to conf.StringSliceType.
	Type conf.OptionType
	// Match is called to evaluate the condition
	// agianst a value.
	Match MatchFunc
	// ConcatFunc defines how multipel conditions of the same type
	// are concatinated together. Only required if Type is a slice.
	// Defaults to NewAnd
	ConcatFunc ConcatFunc
}

// Instance is the instance of a ConditionType bound
// to a value.
type Instance struct {
	*Type
	Value string
}

// Match checks if req matches the condition represented by this instance.
// It implements the Condition interface.
func (instance *Instance) Match(req *http.Request) (bool, error) {
	return instance.Type.Match(req, instance.Value)
}

// Registry manages all available and supported conditions
// and acts a a conf.OptionRegistry.
type Registry struct {
	rw        sync.RWMutex
	providers map[string]*Type
}

// Compile time check
var _ conf.OptionRegistry = new(Registry)

// Register registers a new condition type at the registry.
func (reg *Registry) Register(cond Type) error {
	reg.rw.Lock()
	defer reg.rw.Unlock()

	// default to AND for slice values.
	if cond.Type.IsSliceType() && cond.ConcatFunc == nil {
		cond.ConcatFunc = NewAnd
	}

	lowerName := strings.ToLower(cond.Name)

	if _, ok := reg.providers[lowerName]; ok {
		return errors.New("condition type already registerd")
	}

	reg.providers[lowerName] = &cond

	return nil
}

// All returns all available conf.OptionSpecs and implements
// conf.OptionRegistry.
func (reg *Registry) All() []conf.OptionSpec {
	result := make([]conf.OptionSpec, 0, len(reg.providers))

	reg.rw.RLock()
	defer reg.rw.RUnlock()

	for _, t := range reg.providers {
		optType := t.Type
		if optType == nil {
			optType = conf.StringSliceType
		}

		result = append(result, conf.OptionSpec{
			Name:        "Condition" + t.Name,
			Type:        optType,
			Description: t.Description,
		})
	}

	return result
}

// GetOption returns the conf.OptionSpec for the condition
// identified by name. It implements conf.OptionRegistry.
func (reg *Registry) GetOption(name string) (conf.OptionSpec, bool) {
	reg.rw.RLock()
	defer reg.rw.RUnlock()

	lowerName := strings.ToLower(name)
	for _, t := range reg.providers {
		optName := "Condition" + t.Name
		if strings.ToLower(optName) == lowerName {
			optType := t.Type
			if optType == nil {
				optType = conf.StringSliceType
			}
			return conf.OptionSpec{
				Name:        optName,
				Type:        optType,
				Description: t.Description,
			}, true
		}
	}

	return conf.OptionSpec{}, false
}

// HasOption returns true if the registry has an option with
// name. It implements conf.OptionRegistry.
func (reg *Registry) HasOption(name string) bool {
	_, ok := reg.GetOption(name)
	return ok
}

// DefaultRegistry is the registry used by the package level APIs.
var DefaultRegistry = &Registry{
	providers: make(map[string]*Type),
}

// Register registers a new condition type at the default registry.
func Register(cond Type) error {
	return DefaultRegistry.Register(cond)
}

// MustRegister is like register but panics on error.
func MustRegister(cond Type) {
	if err := Register(cond); err != nil {
		panic(err.Error())
	}
}
