package layouts

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/tierklinik-dobersberg/logger"
)

type Store interface {
	// Get returnes the parsed layout by name.
	Get(ctx context.Context, name string) (*Layout, error)

	// ListNames returns a list of layout names.
	ListNames(ctx context.Context) ([]string, error)
}

type fileStore struct {
	path string

	l       sync.Mutex
	layouts map[string]*Layout
}

// NewFileStore returns a new layout store that loads and persists
// layouts in dir.
func NewFileStore(dir string) (Store, error) {
	if stat, err := os.Stat(dir); err != nil {
		return nil, err
	} else if !stat.IsDir() {
		return nil, fmt.Errorf("%s is not a directory", dir)
	}

	store := &fileStore{
		path: dir,
	}

	if err := store.findLayouts(context.TODO()); err != nil {
		return nil, err
	}

	return store, nil
}

func (fs *fileStore) Get(ctx context.Context, name string) (*Layout, error) {
	fs.l.Lock()
	defer fs.l.Unlock()

	l, ok := fs.layouts[name]
	if !ok {
		return nil, os.ErrNotExist
	}

	copy := new(Layout)
	*copy = *l
	return copy, nil
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

func (fs *fileStore) findLayouts(ctx context.Context) error {
	fs.l.Lock()
	defer fs.l.Unlock()

	fs.layouts = make(map[string]*Layout)

	log := logger.From(ctx)

	dirEntries, err := os.ReadDir(fs.path)
	if err != nil {
		return err
	}

	for _, entry := range dirEntries {
		// layouts must be placed in sub-directories
		if !entry.IsDir() {
			continue
		}

		// TODO(ppacher): should we add support for multiple layouts
		// per directory?
		indexPath := filepath.Join(
			fs.path,
			entry.Name(),
			"index.layout",
		)
		stat, err := os.Lstat(indexPath)
		if err != nil {
			continue
		}
		if stat.IsDir() {
			continue
		}

		l, err := ParseFile(indexPath)
		if err != nil {
			log.Errorf("failed to parse layout: %s", err)
			continue
		}

		fs.layouts[l.Name] = l
	}

	return nil
}
