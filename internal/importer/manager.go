package importer

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"

	"github.com/ppacher/system-conf/conf"
	"github.com/robfig/cron/v3"
	"github.com/tevino/abool"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/pkg/multierr"
	"github.com/tierklinik-dobersberg/cis/runtime"
	"github.com/tierklinik-dobersberg/logger"
)

var (
	ErrImporterNameUsed = errors.New("importer name used")
)

type (
	// FactoryFunc is called to create a one ore more importer instances from config.
	FactoryFunc func(ctx context.Context, app *app.App, config runtime.Section) ([]*Instance, error)

	// Factory creates a new import handler.
	Factory struct {
		runtime.Schema

		// FactoryFunc is used
		FactoryFunc FactoryFunc
	}

	Manager struct {
		app    *app.App
		config *runtime.ConfigSchema

		lock      sync.Mutex
		cron      *cron.Cron
		factories map[string]Factory
		importers map[string][]*Instance
	}

	// Handler is capable of importing data from an external source.
	Handler interface {
		// Import should import data from the external source.
		// The returned interface is published as an event to
		// "event/importer/<instance>/done"
		Import(ctx context.Context) (interface{}, error)
	}

	// ImportFunc implements Handler.
	ImportFunc func(ctx context.Context) (interface{}, error)
)

// Import imports data.
func (fn ImportFunc) Import(ctx context.Context) (interface{}, error) {
	return fn(ctx)
}

func NewManager(ctx context.Context, config *runtime.ConfigSchema, app *app.App) (*Manager, error) {
	mng := &Manager{
		app:       app,
		config:    config,
		cron:      cron.New(cron.WithLocation(app.Location())),
		factories: make(map[string]Factory),
		importers: make(map[string][]*Instance),
	}

	mng.cron.Start()

	return mng, nil
}

func (mng *Manager) Config() *runtime.ConfigSchema { return mng.config }

func (mng *Manager) NotifyChange(ctx context.Context, changeType, id string, sec *conf.Section) error {
	mng.lock.Lock()
	defer mng.lock.Unlock()

	// we treat an "update" like a "delete"+"create" here
	// FIXME(ppacher): importers continue to run after delete
	if changeType != "create" {
		if instances, ok := mng.importers[id]; ok {
			for _, instance := range instances {
				mng.cron.Remove(instance.cronID)
			}
			delete(mng.importers, id)
		}
	}

	if changeType != "delete" && sec != nil {
		if err := mng.create(ctx, runtime.Section{ID: id, Section: *sec}); err != nil {
			return err
		}
	}

	return nil
}

func (mng *Manager) create(ctx context.Context, sec runtime.Section) error {
	errors := new(multierr.Error)

	name := strings.ToLower(sec.Name)
	reg, ok := mng.factories[name]
	if !ok {
		// we don't have a importer configuration for that schema type
		// so abort without an error and ignore it
		return nil
	}

	instances, err := reg.FactoryFunc(ctx, mng.app, sec)
	if err != nil {
		return err
	}

	for idx := range instances {
		instance := instances[idx]

		var err error
		instance.log = logger.From(ctx).WithFields(logger.Fields{
			"id":            sec.ID,
			"instanceIndex": idx,
			"type":          name,
		})
		instance.running = abool.New()
		instance.schedule, err = cron.ParseStandard(instance.Schedule)
		if err != nil {
			errors.Add(err)

			continue
		}

		instance.cronID = mng.cron.Schedule(instance.schedule, instance)
		mng.importers[name] = append(mng.importers[name], instance)

		// trigger the instance now
		go instance.Run()
	}

	return errors.ToError()
}

func (mng *Manager) Register(ctx context.Context, factory Factory) error {
	mng.lock.Lock()
	defer mng.lock.Unlock()

	name := strings.ToLower(factory.Name)

	if _, ok := mng.factories[name]; ok {
		return fmt.Errorf("%w: %s", ErrImporterNameUsed, name)
	}

	if err := mng.config.Register(factory.Schema); err != nil {
		return err
	}

	mng.factories[name] = factory

	// register ourself as a  change notifier for
	// the new importer type.
	// TODO(ppacher): add validator support as well?
	mng.config.AddNotifier(mng, name)

	all, err := mng.config.All(ctx, factory.Name)
	if err != nil {
		return err
	}

	for _, sec := range all {
		if err := mng.create(ctx, sec); err != nil {
			logger.From(ctx).Errorf("failed to create importer for existing configuration %s: %s", sec.ID, err)
		}
	}

	return nil
}
