package httpcond

import (
	"errors"
	"net/http"
	"strings"
	"sync"

	"github.com/ppacher/system-conf/conf"
)

// MatchFunc is the func that validates if a request fullfills
// a condition. Its passed the incoming HTTP request and the
// conditions value. MatchFunc should not care about negating
// or otherwise complex boolean logic (AND/OR) as this is
// handled by the condition chain itself.
type MatchFunc func(req *http.Request, value string) (bool, error)

// Condition descibes the interface that is used to evaluate if a
// HTTP request should be granted an automatic session token.
type Condition interface {
	Match(req *http.Request) (bool, error)
}

// Type describes a condition that must be fullfilled for a request
// to be granted an automatic session token.
type Type struct {
	Name        string
	Description string
	// Type defaults to conf.StringSliceType.
	Type  conf.OptionType
	Match MatchFunc
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

// Register registers a new condition type at the registry.
func (reg *Registry) Register(cond Type) error {
	reg.rw.Lock()
	defer reg.rw.Unlock()

	lowerName := strings.ToLower(cond.Name)

	if _, ok := reg.providers[lowerName]; ok {
		return errors.New("condition type already registerd")
	}

	reg.providers[lowerName] = &cond

	return nil
}

// DefaultRegistry is the registry used by the package level APIs.
var DefaultRegistry = &Registry{
	providers: make(map[string]*Type),
}

// Register registers a new condition type at the default registry.
func Register(cond Type) error {
	return DefaultRegistry.Register(cond)
}
