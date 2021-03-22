// Package autodoc provides automatic documentation for configuration
// files.
package autodoc

import (
	"fmt"
	"path/filepath"
	"strings"
	"sync"

	"github.com/ppacher/system-conf/conf"
)

// File represents a configuration file.
type File struct {
	// Name is the name of the file. If Multiple is true
	// that Name is expected to only hold the expected file
	// extension (like .service or .trigger).
	Name string `json:"name,omitempty"`
	// Description holds a description of the configuration file.
	Description string `json:"description,omitempty"`
	// Multiple should be set to true if multiple units of the
	// described file may exist.
	Multiple bool `json:"multiple"`
	// LookupPaths might be set to the lookup paths that are
	// searched in order.
	LookupPaths []string `json:"lookupPaths,omitempty"`
	// DropinsAllowed should be set to true if drop-in files
	// are supported for this configuration unit.
	DropinsAllowed bool `json:"dropinsAllowed"`
	// Sections holds a list of all sections that are allowed
	// to exist in this file type.
	Sections map[string]conf.OptionRegistry `json:"-"`
	// LazySectionsFunc can be set if some section cannot be determined
	// at init time but must be loaded by different means.
	LazySectionsFunc func() map[string]conf.OptionRegistry `json:"-"`
	// Example may hold a configuration example
	Example string `json:"example,omitempty"`
	// ExampleDescription describes the configuration example
	ExampleDescription string `json:"exampleDescription,omitempty"`
	// Template holds a file template that can be used as a starting base
	Template string `json:"template,omitempty"`
	// LazyTemplateFunc can be used instead of Template if generating a
	// valid Template is not possible during build time.
	LazyTemplateFunc func() string `json:"-"`
}

// Registry keeps track of configuration files.
type Registry struct {
	l         sync.RWMutex
	files     map[string]File
	renderers map[string]Renderer
}

// Register registeres a new configuratin file type.
func (reg *Registry) Register(f File) error {
	reg.l.Lock()
	defer reg.l.Unlock()

	if _, ok := reg.files[f.Name]; ok {
		return fmt.Errorf("configuration file %q already registered", f.Name)
	}

	reg.files[f.Name] = f

	return nil
}

// RegisterRenderer registers a new autodoc renderer.
func (reg *Registry) RegisterRenderer(kind string, renderer Renderer) error {
	reg.l.Lock()
	defer reg.l.Unlock()

	kind = strings.ToLower(kind)
	if _, ok := reg.renderers[kind]; ok {
		return fmt.Errorf("renderer for %s already registered", kind)
	}
	reg.renderers[kind] = renderer
	return nil
}

// List returns a list of all configuration files supported.
func (reg *Registry) List() []File {
	reg.l.RLock()
	defer reg.l.RUnlock()

	result := make([]File, 0, len(reg.files))
	for _, file := range reg.files {
		result = append(result, file)
	}
	return result
}

// Render renders f as kind.
func (reg *Registry) Render(kind string, f File) (string, error) {
	reg.l.RLock()
	defer reg.l.RUnlock()

	renderer, ok := reg.renderers[strings.ToLower(kind)]
	if !ok {
		return "", fmt.Errorf("no renderer for %q registered", kind)
	}

	return renderer.RenderFile(f)
}

// DocsFor returns the documentation that matches p.
// Note that LookupPaths are not checked here.
func (reg *Registry) DocsFor(p string) (File, bool) {
	reg.l.RLock()
	defer reg.l.RUnlock()

	name := filepath.Base(p)
	if f, ok := reg.files[name]; ok {
		return f, ok
	}

	ext := filepath.Ext(name)
	if f, ok := reg.files[ext]; ok {
		return f, ok
	}

	return File{}, false
}

// NewRegistry creates a new registry.
func NewRegistry() *Registry {
	return &Registry{
		files:     make(map[string]File),
		renderers: make(map[string]Renderer),
	}
}

// Register calls DefaultRegistry.Register(f).
func Register(f File) error {
	return DefaultRegistry.Register(f)
}

// MustRegister is like Register but panics in case of an
// error.
func MustRegister(f File) {
	if err := Register(f); err != nil {
		panic(err)
	}
}

// RegisterRenderer calls DefaultRegistry.RegisterRenderer
func RegisterRenderer(kind string, renderer Renderer) error {
	return DefaultRegistry.RegisterRenderer(kind, renderer)
}

// MustRegisterRenderer is like RegisterRenderer but panics on error.
func MustRegisterRenderer(kind string, renderer Renderer) {
	if err := RegisterRenderer(kind, renderer); err != nil {
		panic(err)
	}
}

// DefaultRegistry is the default registry used by all package-level
// functions.
var DefaultRegistry = NewRegistry()
