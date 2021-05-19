package cctv

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/httperr"
	"github.com/tierklinik-dobersberg/cis/internal/utils"
)

// Manager manages cameras and distributes images
// to all subscribers.
type Manager struct {
	rl      sync.RWMutex
	cameras map[string]*Camera
}

// LoadDefinitions loads all camera definitions (.camera) from
// dir.
func (mng *Manager) LoadDefinitions(dir string) error {
	files, err := utils.LoadFiles(dir, ".camera", CameraUnit)
	if err != nil {
		return err
	}

	mng.rl.Lock()
	defer mng.rl.Unlock()
	if mng.cameras == nil {
		mng.cameras = make(map[string]*Camera)
	}
	for _, f := range files {
		var (
			cam  Camera
			base = filepath.Base(f.Path)
			name = strings.TrimSuffix(base, filepath.Ext(base))
		)
		if err := CameraUnit.Sections.Decode(f, &cam); err != nil {
			return fmt.Errorf("%s: %w", f.Path, err)
		}

		mng.cameras[name] = &cam
	}
	return nil
}

// ListDefinitions returns a map of all camera defintions known
// by the manager.
func (mng *Manager) ListDefinitions() map[string]CameraMeta {
	mng.rl.RLock()
	defer mng.rl.RUnlock()

	res := make(map[string]CameraMeta)
	for key, cam := range mng.cameras {
		res[key] = cam.Meta
	}
	return res
}

// AttachToStream attaches the request c to the stream of camera camID.
func (mng *Manager) AttachToStream(ctx context.Context, camID string, c *gin.Context) error {
	mng.rl.RLock()
	cam, ok := mng.cameras[camID]
	mng.rl.RUnlock()
	if !ok {
		return httperr.NotFound("camera", camID, nil)
	}
	// use the first source available
	if cam.MJPEGSource != nil {
		return cam.MJPEGSource.Attach(ctx, c)
	}
	return httperr.InternalError(
		fmt.Errorf("no usable source for camera %s", camID),
	)
}
