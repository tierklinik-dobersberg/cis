package cctv

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/pkg/confutil"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
)

// contextKeyCameraMeta is used to attach the camera meta data to
// a request context key before the request is attached to the source.
var contextKeyCameraMeta = struct{ S string }{"camera-meta"}

// metaFromCtx returns the CameraMeta attached to ctx.
func metaFromCtx(ctx context.Context) CameraMeta {
	val, ok := ctx.Value(contextKeyCameraMeta).(*CameraMeta)
	if !ok {
		return CameraMeta{}
	}
	return *val
}

// Manager manages cameras and distributes images
// to all subscribers.
type Manager struct {
	rl      sync.RWMutex
	cameras map[string]*Camera
}

// LoadDefinitions loads all camera definitions (.camera) from
// dir.
func (mng *Manager) LoadDefinitions(dir string) error {
	files, err := confutil.LoadFiles(dir, ".camera", CameraUnit)
	if err != nil {
		return fmt.Errorf("failed to load .camera files: %w", err)
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
		if err := conf.DecodeFile(f, &cam, CameraUnit); err != nil {
			return fmt.Errorf("%s: %w", f.Path, err)
		}

		cam.Meta.ID = name
		mng.cameras[name] = &cam
	}
	return nil
}

// ListDefinitions returns a map of all camera definitions known
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

	ctx = context.WithValue(ctx, contextKeyCameraMeta, &cam.Meta)

	// use the first source available
	if cam.MJPEGSource != nil {
		return cam.MJPEGSource.Attach(ctx, c)
	}
	return httperr.InternalError(
		fmt.Errorf("no usable source for camera %s", camID),
	)
}
