package utils

import (
	"path/filepath"

	"github.com/ppacher/system-conf/conf"
)

// LoadFiles loads all files in dir that have the extension ext and
// parses them using spec.
func LoadFiles(dir, ext string, spec conf.SectionRegistry) ([]*conf.File, error) {
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
