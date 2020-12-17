package loader

import (
	"path/filepath"

	"github.com/ppacher/system-conf/conf"
)

// Loader loads user and group definitions from the file system.
type Loader struct {
	dir string
}

// New returns a new loader that uses the given paths
// as it's search roots.
func New(path string) *Loader {
	return &Loader{
		dir: path,
	}
}

// LoadFiles loads all files in dir that have the extension ext and
// parses them using spec.
func LoadFiles(dir, ext string, spec conf.FileSpec) ([]*conf.File, error) {
	names := make(map[string]struct{})
	files := make([]*conf.File, 0)

	dirFiles, err := conf.ReadDir(dir, ext, spec)
	if err != nil {
		return nil, err
	}

	for _, file := range dirFiles {
		name := filepath.Base(file.Path)
		if _, ok := names[name]; ok {
			continue
		}

		dropins, err := conf.LoadDropIns(filepath.Base(file.Path), []string{dir})
		if err != nil {
			return nil, err
		}

		if err := conf.ApplyDropIns(file, dropins, spec); err != nil {
			return nil, err
		}

		files = append(files, file)
		names[name] = struct{}{}
	}

	return files, nil
}
