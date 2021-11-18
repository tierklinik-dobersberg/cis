package tasks

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/robfig/cron/v3"
	"github.com/tierklinik-dobersberg/logger"
)

// TaskFunc is that is executed when a task runs.
type TaskFunc func(context.Context) error

// Task is a workload that runs async on a given cron schedule.
// The same task is guaranteed to not run twice.
type Task struct {
	// Name is the name of the task.
	Name string

	// TaskFunc is the actual function that should be executed
	// when the task runs.
	TaskFunc TaskFunc

	// Deadline can be set to the maximum duration the task is
	// allowed to run. The context passed to TaskFunc is cancelled
	// with the deadline.
	Deadline time.Duration

	// StartNow can be set to true if the task should run immediately
	// when the task manager is started.
	StartNow bool

	// Schedule holds the cron schedule at which the task should be
	// executed.
	Schedule string

	// rootCtx is used to create a new context for this tasks whenever
	// it is executed.
	rootCtx context.Context

	// cronEntry holds the ID of the task entry inside the cron scheduler.
	cronEntry cron.EntryID

	lastLock     sync.Mutex
	lastErr      error
	lastExecTime time.Time
}

// LastResult returns time and the error of the last execution.
// If the task has not yet been executed a zero time is returned
// together with a nil error.
func (task *Task) LastResult() (time.Time, error) {
	task.lastLock.Lock()
	defer task.lastLock.Unlock()
	return task.lastExecTime, task.lastErr
}

// Manager manages and schedules tasks register on it. The manager
// must be started for any tasks to get scheduled. Once started
// tasks are scheduled as long as the manager is not stopped.
type Manager struct {
	l       sync.RWMutex
	tasks   []*Task
	ctx     context.Context
	cron    *cron.Cron
	running bool
}

// NewManager returns a new task manager that is configured
// to interpret cron schedule as at the timezone loc.
// If loc is nil then time.UTC will be used.
func NewManager(loc *time.Location) *Manager {
	if loc == nil {
		loc = time.UTC
	}
	mng := &Manager{
		// TODO(ppacher): add WithLogger()?
		cron: cron.New(cron.WithLocation(loc)),
	}
	return mng
}

// Start starts the manager and the cron scheduler. Tasks that
// are marked as StartNow are executed immediately in a dedicated
// goroutine.
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
			// BUG(ppacher): see bug in Manager.Register(*Task)
			go t.Run()
		}
	}

	go func() {
		<-ctx.Done()
		<-mng.cron.Stop().Done()
	}()
}

// Stop stops the manager and waits for all running tasks to
// complete. Running tasks are NOT cancelled! If the user wants
// to cancel all tasks the context passed to mng.Start() should
// be cancelled instead. Afterwards a call to Stop() will make
// sure that no more tasks get scheduled and will wait for all
// running tasks to finish.
func (mng *Manager) Stop() {
	mng.l.Lock()
	defer mng.l.Unlock()

	<-mng.cron.Stop().Done()
}

// Register registers task at mng. An error can only be
// returned when the Schedule field of task cannot be
// parsed.
// If StartNow is set to true on task it will be executed
// as soon as the manager is started.
// If mng has already been started and StartNow is true
// the task is executed immediately in a dedicated go-routine.
func (mng *Manager) Register(task *Task) error {
	var err error

	mng.l.Lock()
	defer mng.l.Unlock()

	if mng.running {
		task.rootCtx = mng.ctx
		if task.StartNow {
			// BUG(ppacher): right now it is possible for the
			// task to run twice at the same time because
			// the cron-schedule might also execute the task
			// the next moment.
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

// Run actually runs the task. Any panic thrown by the TaskFunc
// is caught and stored as the last execution error.
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

// DefaultManager is the default task manage of this package.
// Users of the DefaultManager must make sure that no unwanted
// tasks are registered automatically by the init() functions
// of other packages. For safety, users are adviced to use
// NewManager on their own and register all required tasks
// manually.
// Creators of tasks are adivced to export a RegisterOn(mng *Manager)
// method that can be used to register a task on a certain
// manager.
var DefaultManager = NewManager(time.Local)

// Register registers t at the DefaultManager.
func Register(t *Task) error {
	return DefaultManager.Register(t)
}

// Start starts the DefaultManager.
func Start(ctx context.Context) {
	DefaultManager.Start(ctx)
}
