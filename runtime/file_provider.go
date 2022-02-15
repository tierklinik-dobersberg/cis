package runtime

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/ppacher/system-conf/conf"
)

type FileProvider struct {
	File *conf.File
}

func (cfg *FileProvider) Create(ctx context.Context, sec conf.Section) (string, error) {
	return "", ErrReadOnly
}

func (cfg *FileProvider) Update(ctx context.Context, id string, opts []conf.Option) error {
	return ErrReadOnly
}

func (cfg *FileProvider) Delete(ctx context.Context, id string) error {
	return ErrReadOnly
}

func (cfg *FileProvider) Get(ctx context.Context, sectionType string) ([]Section, error) {
	sections := cfg.File.GetAll(sectionType)
	if len(sections) == 0 {
		return []Section{}, nil
	}

	result := make([]Section, len(sections))

	for idx, sec := range sections {
		result[idx] = Section{
			ID:      cfg.makeKey(sectionType, idx),
			Section: sec,
		}
	}

	return result, nil
}

func (cfg *FileProvider) GetID(ctx context.Context, id string) (Section, error) {
	secType, idx, err := cfg.parseKey(id)
	if err != nil {
		return Section{}, err
	}

	sections := cfg.File.GetAll(secType)
	if len(sections) <= idx {
		return Section{}, ErrCfgSectionNotFound
	}

	return Section{
		ID:      id,
		Section: sections[idx],
	}, nil
}

func (cfg *FileProvider) makeKey(secType string, idx int) string {
	return fmt.Sprintf("%s/%d", secType, idx)
}

func (cfg *FileProvider) parseKey(key string) (secType string, idx int, err error) {
	parts := strings.Split(key, "/")
	if len(parts) != 2 {
		return "", 0, fmt.Errorf("section id: invalid number of segments")
	}

	idx64, err := strconv.ParseInt(parts[1], 0, 0)
	if err != nil {
		return "", 0, fmt.Errorf("section id: invalid index number: %w", err)
	}

	return parts[0], int(idx64), nil
}
