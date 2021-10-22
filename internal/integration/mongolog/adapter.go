package mongolog

import (
	"container/list"
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/tierklinik-dobersberg/cis/internal/cfgspec"
	"github.com/tierklinik-dobersberg/logger"
	"go.mongodb.org/mongo-driver/mongo"
)

var LogsCollection = "mongolog"

type Record struct {
	Time           time.Time              `json:"time" bson:"time,omitempty"`
	UnixEpoch      int64                  `json:"unixEpoch" bson:"unixEpoch"`
	Severity       int                    `json:"severity" bson:"severity"`
	SeverityString string                 `json:"severityString" bson:"severityString"`
	Message        string                 `json:"message" bson:"message"`
	Fields         map[string]interface{} `json:"fields" bson:"fields"`
}

type Adapter struct {
	collection    *mongo.Collection
	lock          sync.Mutex
	pendingLogs   *list.List
	triggerWrite  chan struct{}
	packageLevels map[string]logger.Severity
	defaultLevel  logger.Severity
}

// NewWithClient returns a new mongolog Adapter using cli.
func NewWithClient(ctx context.Context, dbName string, cli *mongo.Client, cfg cfgspec.MongoLogConfig) (*Adapter, error) {
	adapter := &Adapter{
		collection:  cli.Database(dbName).Collection(LogsCollection),
		pendingLogs: list.New().Init(),
	}

	if err := adapter.setup(ctx, cfg); err != nil {
		return nil, err
	}

	return adapter, nil
}

func (adapter *Adapter) setup(ctx context.Context, cfg cfgspec.MongoLogConfig) error {
	var err error
	adapter.defaultLevel, err = cfgspec.ParseLogLevel(cfg.DefaultLevel)
	if err != nil {
		return err
	}

	adapter.packageLevels = make(map[string]logger.Severity)
	for idx, value := range cfg.PackageLevel {
		parts := strings.Split(value, "=")
		if len(parts) != 2 {
			return fmt.Errorf("invalid format for PackageLevel in %q (#%d)", value, idx)
		}

		level, err := cfgspec.ParseLogLevel(parts[1])
		if err != nil {
			return fmt.Errorf("failed to parse log-level in %s", value)
		}
		adapter.packageLevels[parts[0]] = level
	}

	go adapter.writeLogs()

	return nil
}

func (adapter *Adapter) writeLogs() {
	for {
		adapter.lock.Lock()
		elem := adapter.pendingLogs.Front()
		if elem != nil {
			adapter.pendingLogs.Remove(elem)
		}
		adapter.lock.Unlock()

		if elem == nil {
			select {
			case <-adapter.triggerWrite:
			case <-time.After(time.Second):
			}
			continue
		}

		_, err := adapter.collection.InsertOne(context.Background(), elem.Value)
		if err != nil {
			log.Printf("failed to publish log record to mongodb: %s", err.Error())
		}
	}
}

func (adapter *Adapter) canWrite(severity logger.Severity, fields logger.Fields) bool {
	defaultResult := severity <= logger.Severity(adapter.defaultLevel)

	pkg, ok := fields["package"]
	if !ok {
		return defaultResult
	}

	pkgStr, ok := pkg.(string)
	if !ok {
		return defaultResult
	}

	lvl, ok := adapter.packageLevels[pkgStr]
	if !ok {
		return defaultResult
	}

	return severity <= logger.Severity(lvl)
}

func (adapter *Adapter) Write(t time.Time, severity logger.Severity, msg string, fields logger.Fields) {
	record := &Record{
		Time:           t,
		UnixEpoch:      t.UnixNano(),
		Severity:       int(severity),
		SeverityString: severity.String(),
		Message:        msg,
		Fields:         map[string]interface{}(fields),
	}

	adapter.lock.Lock()
	write := adapter.canWrite(severity, fields)
	if write {
		adapter.pendingLogs.PushBack(record)
	}
	adapter.lock.Unlock()

	if write {
		select {
		case adapter.triggerWrite <- struct{}{}:
		default:
		}
	}
}

// Compile time check.
var _ logger.Adapter = new(Adapter)
