package layouts

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/logger"
)

type Store interface {
	// Get returnes the parsed layout by name.
	Get(ctx context.Context, name string) (*Layout, error)

	// ListNames returns a list of layout names.
	ListNames(ctx context.Context) ([]string, error)
}

type fileStore struct {
	paths []string

	l       sync.Mutex
	layouts map[string]*Layout
}

// NewFileStore returns a new layout store that loads and persists
// layouts in dir.
func NewFileStore(ctx context.Context, dirs []string) (Store, error) {
	for _, dir := range dirs {
		stat, err := os.Stat(dir)
		if err != nil {
			logger.From(ctx).Errorf("failed to stat layout directory %s: %s", dir, err)
			continue
		}
		if err == nil && !stat.IsDir() {
			return nil, fmt.Errorf("%s is not a directory", dir)
		}
	}

	store := &fileStore{
		paths:   dirs,
		layouts: make(map[string]*Layout),
	}

	store.findLayouts(ctx)

	// periodically scan for new layouts in the background
	go func() {
		for {
			select {
			case <-time.After(time.Minute * 10):
			case <-ctx.Done():
				return
			}

			store.findLayouts(ctx)
		}
	}()

	return store, nil
}

func (fs *fileStore) Get(ctx context.Context, name string) (*Layout, error) {
	fs.l.Lock()
	defer fs.l.Unlock()

	l, ok := fs.layouts[name]
	if !ok {
		return nil, httperr.NotFound("layout", name, os.ErrNotExist)
	}

	cpy := new(Layout)
	*cpy = *l
	return cpy, nil
}

func (fs *fileStore) ListNames(ctx context.Context) ([]string, error) {
	fs.l.Lock()
	defer fs.l.Unlock()

	names := make([]string, 0, len(fs.layouts))
	for name := range fs.layouts {
		names = append(names, name)
	}
	return names, nil
}

func (fs *fileStore) findLayouts(ctx context.Context) {
	log := logger.From(ctx)
	log.V(7).Logf("scanning for new infoscreen layouts...")

	fs.l.Lock()
	defer fs.l.Unlock()

	fs.layouts = make(map[string]*Layout)

	for _, path := range fs.paths {
		dirEntries, err := os.ReadDir(path)
		if err != nil {
			log.Errorf("failed to read directory %s: %w", path, err)
			continue
		}

		for _, entry := range dirEntries {
			if entry.IsDir() {
				log.V(7).Logf("skipping %s as it's a directory", entry.Name())
				continue
			}

			if filepath.Ext(entry.Name()) != ".hcl" {
				log.V(7).Logf("skippping %s as it's not a .hcl file", entry.Name())
			}

			// TODO(ppacher): should we add support for multiple layouts
			// per directory?
			indexPath := filepath.Join(
				path,
				entry.Name(),
			)
			stat, err := os.Lstat(indexPath)
			if err != nil {
				log.V(7).Logf("skipping %s as we failed to lstat layout.hcl: %w", entry.Name(), err)
				continue
			}
			if stat.IsDir() {
				log.V(7).Logf("skipping %s as we failed to layout.hcl is a directory", entry.Name())
				continue
			}

			l, err := ParseFile(indexPath)
			if err != nil {
				log.Errorf("failed to parse layout: %s", err)
				continue
			}

			fs.layouts[l.Name] = l
		}
	}

	log.V(5).Logf("found %d layouts across %d search paths", len(fs.layouts), len(fs.paths))
}

type NoopStore struct{}

func (*NoopStore) ListNames(context.Context) ([]string, error) {
	return nil, httperr.PreconditionFailed("feature disabled")
}

func (*NoopStore) Get(context.Context, string) (*Layout, error) {
	return nil, httperr.PreconditionFailed("feature disabled")
}
