package importer

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/robfig/cron/v3"
	"github.com/tevino/abool"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
	"github.com/tierklinik-dobersberg/cis/runtime/event"
	"github.com/tierklinik-dobersberg/logger"
)

var log = pkglog.New("importer")

// Handler is capable of importing data from an external source.
type Handler interface {
	// Import should import data from the external source.
	Import() (interface{}, error)
}

// ImportFunc implements Importer.
type ImportFunc func() (interface{}, error)

// Import imports data.
func (fn ImportFunc) Import() (interface{}, error) {
	return fn()
}

// Instance is a import handler instance that executes
// at a certain schedule.
type Instance struct {
	ID             string
	Schedule       string
	RunImmediately bool
	Handler        Handler

	log      logger.Logger
	schedule cron.Schedule
	running  *abool.AtomicBool
}

// Run implements cron.Job
func (inst *Instance) Run() {
	if !inst.running.SetToIf(false, true) {
		inst.log.Infof("Import still running, skipping scheudle")
		return
	}
	defer inst.running.UnSet()

	event.Fire(
		context.Background(),
		fmt.Sprintf("event/importer/%s/start", inst.ID),
		ImportStartedEvent{
			Importer: inst.ID,
			Time:     time.Now(),
		},
	)

	inst.log.Info("Starting import")
	start := time.Now()
	defer func() {
		inst.log.Infof("Import finished after %s", time.Since(start))
	}()

	data, err := inst.Handler.Import()
	errMsg := ""
	if err != nil {
		inst.log.Errorf("importer %s failed: %s", inst.ID, err)
		errMsg = err.Error()
	}

	event.Fire(
		context.Background(),
		fmt.Sprintf("event/importer/%s/done", inst.ID),
		ImportFinsihedEvent{
			Importer: inst.ID,
			Time:     time.Now(),
			Data:     data,
			Error:    errMsg,
		},
	)
}

// FactoryFunc creates a new import handler based on cfg.
type FactoryFunc func(app *app.App) ([]*Instance, error)

// Factory creates a new import handler.
type Factory struct {
	Name  string
	Setup FactoryFunc
}

// Factories holds all available import factories
var (
	factoriesLock sync.RWMutex
	factories     []Factory
)

// Register registers a new factory.
func Register(factory Factory) {
	factoriesLock.Lock()
	defer factoriesLock.Unlock()

	factories = append(factories, factory)
}

// Importer imports data from external systems
type Importer struct {
	cron      *cron.Cron
	instances []*Instance
}

// New creates a new importer from cfg.
func New(ctx context.Context, app *app.App) (*Importer, error) {
	imp := &Importer{}

	c := cron.New(
		cron.WithLocation(app.Location()),
	)

	imp.cron = c

	if err := imp.setup(ctx, app); err != nil {
		return nil, err
	}

	return imp, nil
}

func (imp *Importer) setup(ctx context.Context, app *app.App) error {
	factoriesLock.RLock()
	defer factoriesLock.RUnlock()

	var instances []*Instance
	for _, fn := range factories {
		log.From(ctx).Infof("creating importers for %s", fn.Name)
		res, err := fn.Setup(app)
		if err != nil {
			return fmt.Errorf("importer %s: %w", fn.Name, err)
		}

		for _, inst := range res {
			var err error
			inst.schedule, err = cron.ParseStandard(inst.Schedule)
			inst.log = log.From(ctx).WithFields(logger.Fields{
				"importer": fn.Name,
				"id":       inst.ID,
			})
			inst.running = abool.New()

			if err != nil {
				return fmt.Errorf("invalid schedule %q: %w", inst.Schedule, err)
			}

			instances = append(instances, inst)
		}
	}

	for _, inst := range instances {
		imp.cron.Schedule(inst.schedule, inst)
		imp.instances = append(imp.instances, inst)
	}

	log.From(ctx).Infof("created and scheduled %d importers", len(instances))

	return nil
}

// Start starts the importer. It will run as long as ctx is not cancelled.
func (imp *Importer) Start(ctx context.Context) error {
	// kick of any instances that run immediately
	for _, inst := range imp.instances {
		if inst.RunImmediately {
			go inst.Run()
		}
	}

	imp.cron.Start()

	go func() {
		<-ctx.Done()
		<-imp.cron.Stop().Done()
	}()

	return nil
}
