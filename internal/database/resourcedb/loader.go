package resourcedb

import (
	"fmt"
	"path/filepath"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/utils"
)

// LoadFiles loads all resource files from dir. It returns the
// first error encountered.roster
func LoadFiles(reg *Registry, dir string) error {
	files, err := utils.LoadFiles(dir, ".resource", ResourceUnit)
	if err != nil {
		return err
	}

	for _, f := range files {
		var file struct {
			Resource Resource
		}
		if err := conf.DecodeFile(f, &file, ResourceUnit); err != nil {
			return fmt.Errorf("%s: %w", f.Path, err)
		}
		file.Resource.ID = filepath.Base(f.Path)
		if err := reg.Create(file.Resource); err != nil {
			return fmt.Errorf("%s: %w", f.Path, err)
		}
	}

	return nil
}
