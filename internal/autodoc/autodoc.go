// Package autodoc provides automatic documentation for configuration
// files.
package autodoc

import (
	"fmt"
	"path/filepath"
	"strings"
	"sync"
)

// Registry keeps track of configuration files.
type Registry struct {
	l         sync.RWMutex
	files     map[string]*File
	renderers map[string]Renderer
}

// Register registeres a new configuratin file type.
func (reg *Registry) Register(f File) (*File, error) {
	reg.l.Lock()
	defer reg.l.Unlock()

	if _, ok := reg.files[f.Name]; ok {
		return nil, fmt.Errorf("configuration file %q already registered", f.Name)
	}

	reg.files[f.Name] = &f

	return &f, nil
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
		result = append(result, *file)
	}
	return result
}

// Render renders f as kind.
func (reg *Registry) Render(kind string, f *File) (string, error) {
	reg.l.RLock()
	defer reg.l.RUnlock()

	renderer, ok := reg.renderers[strings.ToLower(kind)]
	if !ok {
		return "", fmt.Errorf("no renderer for %q registered", kind)
	}

	return renderer.RenderFile(*f)
}

// DocsFor returns the documentation that matches p.
// Note that LookupPaths are not checked here.
func (reg *Registry) DocsFor(p string) (*File, bool) {
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

	return nil, false
}

// NewRegistry creates a new registry.
func NewRegistry() *Registry {
	return &Registry{
		files:     make(map[string]*File),
		renderers: make(map[string]Renderer),
	}
}

// Register calls DefaultRegistry.Register(f).
func Register(f File) (*File, error) {
	return DefaultRegistry.Register(f)
}

// MustRegister is like Register but panics in case of an
// error.
func MustRegister(f File) *File {
	file, err := Register(f)
	if err != nil {
		panic(err)
	}
	return file
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
