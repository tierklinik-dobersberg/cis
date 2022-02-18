package fileprovider

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/runtime"
)

type FileProvider struct {
	File *conf.File
}

// New creates a new runtime.ConfigProvider using data stored in
// cfgFile.
func New(cfgFile *conf.File) *FileProvider {
	return &FileProvider{File: cfgFile}
}

func (cfg *FileProvider) Create(ctx context.Context, sec conf.Section) (string, error) {
	return "", runtime.ErrReadOnly
}

func (cfg *FileProvider) Update(ctx context.Context, id, secType string, opts []conf.Option) error {
	return runtime.ErrReadOnly
}

func (cfg *FileProvider) Delete(ctx context.Context, id string) error {
	return runtime.ErrReadOnly
}

func (cfg *FileProvider) Get(ctx context.Context, sectionType string) ([]runtime.Section, error) {
	sections := cfg.File.GetAll(sectionType)
	if len(sections) == 0 {
		return []runtime.Section{}, nil
	}

	result := make([]runtime.Section, len(sections))

	for idx, sec := range sections {
		result[idx] = runtime.Section{
			ID:      cfg.makeKey(sectionType, idx),
			Section: sec,
		}
	}

	return result, nil
}

func (cfg *FileProvider) GetID(ctx context.Context, id string) (runtime.Section, error) {
	secType, idx, err := cfg.parseKey(id)
	if err != nil {
		return runtime.Section{}, err
	}

	sections := cfg.File.GetAll(secType)
	if len(sections) <= idx {
		return runtime.Section{}, runtime.ErrCfgSectionNotFound
	}

	return runtime.Section{
		ID:      id,
		Section: sections[idx],
	}, nil
}

func (cfg *FileProvider) makeKey(secType string, idx int) string {
	return fmt.Sprintf("%s-%d", secType, idx)
}

func (cfg *FileProvider) parseKey(key string) (secType string, idx int, err error) {
	parts := strings.Split(key, "-")
	if len(parts) != 2 {
		return "", 0, fmt.Errorf("section id: invalid number of segments")
	}

	idx64, err := strconv.ParseInt(parts[1], 0, 0)
	if err != nil {
		return "", 0, fmt.Errorf("section id: invalid index number: %w", err)
	}

	return parts[0], int(idx64), nil
}
