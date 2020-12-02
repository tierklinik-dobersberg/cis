package loader

import (
	"io"
	"os"
	"path/filepath"

	"github.com/tierklinik-dobersberg/logger"
)

func (ldr *Loader) LoadAvatar(path string, fileName string) (io.ReadSeeker, error) {
	filePath := filepath.Clean(filepath.Join(path, fileName))

	logger.DefaultLogger().Infof("Loading avatar from %s", filePath)

	f, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}

	return f, nil
}
