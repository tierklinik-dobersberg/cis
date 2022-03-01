package importer

import (
	"context"
	"fmt"
	"time"

	"github.com/robfig/cron/v3"
	"github.com/tevino/abool"
	"github.com/tierklinik-dobersberg/cis/runtime/event"
	"github.com/tierklinik-dobersberg/logger"
)

// Instance is a import handler instance that executes
// at a certain schedule.
type Instance struct {
	ID             string
	Schedule       string
	RunImmediately bool
	Handler        Handler

	cronID   cron.EntryID
	log      logger.Logger
	schedule cron.Schedule
	running  *abool.AtomicBool
}

// Run implements cron.Job.
func (inst *Instance) Run() {
	if !inst.running.SetToIf(false, true) {
		inst.log.Infof("Import still running, skipping schedule")

		return
	}
	defer inst.running.UnSet()

	ctx := context.Background()
	ctx = logger.With(ctx, inst.log)

	start := time.Now()
	event.Fire(
		context.Background(),
		fmt.Sprintf("event/importer/%s/start", inst.ID),
		ImportStartedEvent{
			Importer: inst.ID,
			Time:     start,
		},
	)

	inst.log.Info("Starting import")
	defer func() {
		inst.log.Infof("Import finished after %s", time.Since(start))
	}()

	data, err := inst.Handler.Import(ctx)
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
			Duration: time.Since(start),
			Data:     data,
			Error:    errMsg,
		},
	)
}
