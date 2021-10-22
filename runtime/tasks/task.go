package tasks

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/robfig/cron/v3"
	"github.com/tierklinik-dobersberg/logger"
)

type TaskFunc func(context.Context) error

type Task struct {
	Name     string
	TaskFunc TaskFunc
	Deadline time.Duration
	StartNow bool
	Schedule string

	rootCtx   context.Context
	cronEntry cron.EntryID

	lastLock     sync.Mutex
	lastErr      error
	lastExecTime time.Time
}

func (task *Task) LastResult() (time.Time, error) {
	task.lastLock.Lock()
	defer task.lastLock.Unlock()
	return task.lastExecTime, task.lastErr
}

type Manager struct {
	l       sync.RWMutex
	tasks   []*Task
	ctx     context.Context
	cron    *cron.Cron
	running bool
}

func NewManager(loc *time.Location) *Manager {
	mng := &Manager{
		// TODO(ppacher): add WithLogger()?
		cron: cron.New(cron.WithLocation(loc)),
	}
	return mng
}

func (mng *Manager) Start(ctx context.Context) {
	mng.l.Lock()
	defer mng.l.Unlock()

	if mng.running {
		return
	}

	mng.running = true
	mng.ctx = ctx
	mng.cron.Start()

	for _, t := range mng.tasks {
		t.rootCtx = ctx
		if t.StartNow {
			go t.Run()
		}
	}

	go func() {
		<-ctx.Done()
		<-mng.cron.Stop().Done()
	}()
}

func (mng *Manager) Register(task *Task) error {
	var err error

	mng.l.Lock()
	defer mng.l.Unlock()

	if mng.running {
		task.rootCtx = mng.ctx
		if task.StartNow {
			go task.Run()
		}
	}

	task.cronEntry, err = mng.cron.AddJob(task.Schedule, task)
	if err != nil {
		return err
	}
	mng.tasks = append(mng.tasks, task)

	return err
}

func (task *Task) Run() {
	start := time.Now()
	ctx := task.rootCtx
	if ctx == nil {
		ctx = context.Background()
	}
	ctx = logger.WithFields(ctx, logger.Fields{
		"task":  task.Name,
		"start": start,
	})

	logger.From(ctx).Infof("starting task")

	if task.Deadline > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithDeadline(ctx, time.Now().Add(task.Deadline))
		defer cancel()
	}

	var execErr error
	defer func() {
		if x := recover(); x != nil {
			if e, ok := x.(error); ok {
				execErr = e
			} else {
				execErr = fmt.Errorf("%v", x)
			}
		}

		errStr := ""
		if execErr != nil {
			errStr = execErr.Error()
		}
		logger.From(ctx).WithFields(logger.Fields{
			"lastErr":  errStr,
			"duration": time.Since(start),
		}).Infof("task finished")

		task.lastLock.Lock()
		defer task.lastLock.Unlock()
		task.lastErr = execErr
		task.lastExecTime = start
	}()

	execErr = task.TaskFunc(ctx)
}

var DefaultManager = NewManager(time.Local)

func Register(t *Task) error {
	return DefaultManager.Register(t)
}

func Start(ctx context.Context) {
	DefaultManager.Start(ctx)
}
