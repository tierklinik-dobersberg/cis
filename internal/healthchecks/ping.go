package healthchecks

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/tierklinik-dobersberg/cis/pkg/confutil"
	"github.com/tierklinik-dobersberg/cis/pkg/trace"
	"github.com/tierklinik-dobersberg/cis/runtime"
	"github.com/tierklinik-dobersberg/cis/runtime/event"
	"github.com/tierklinik-dobersberg/logger"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
)

type Tracker struct {
	PingDefinition

	pings    *mongo.Collection
	configDB *runtime.ConfigSchema

	lock     sync.Mutex
	lastTime time.Time
}

type PingStateChangedPayload struct {
	PingDefinition
	From string
}

var (
	PingStateChanged = event.MustRegisterType(event.Type{
		ID:          "vet.dobersberg.cis/hc/ping-state-changed",
		Description: "The state of a healthcheck ping changed",
	})
)

// NewTracker returns a new ping tracker.
func NewTracker(ctx context.Context, def PingDefinition, configDB *runtime.ConfigSchema, pings *mongo.Collection) (*Tracker, error) {
	tracker := &Tracker{
		PingDefinition: def,
		pings:          pings,
		configDB:       configDB,
	}

	pingOid, err := primitive.ObjectIDFromHex(def.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to parse ping ID %s: %w", def.ID, err)
	}

	res := tracker.pings.FindOne(
		ctx,
		bson.M{
			"pingID": pingOid,
		},
		options.FindOne().SetSort(bson.M{"createdAt": 1}),
	)
	if res.Err() == nil {
		var record PingRecord
		if err := res.Decode(&record); err != nil {
			err := fmt.Errorf("failed to decode ping: %w", res.Err())

			trace.RecordAndLog(ctx, err, "ping.id", tracker.ID, "ping.name", tracker.Name)
		}

		tracker.lastTime = record.Time
		if !record.Fail {
			tracker.PingDefinition.State = tracker.evaluateState()
		} else {
			tracker.PingDefinition.State = "failed"
		}
	} else if !errors.Is(res.Err(), mongo.ErrNoDocuments) {
		trace.RecordAndLog(ctx, res.Err(), "ping.id", tracker.ID, "ping.name", tracker.Name)
	}

	return tracker, nil
}

func (tracker *Tracker) State() string {
	tracker.lock.Lock()
	defer tracker.lock.Unlock()

	return tracker.evaluateState()
}

func (tracker *Tracker) SetFailed(ctx context.Context) error {
	tracker.lock.Lock()
	defer tracker.lock.Unlock()

	ctx, sp := otel.Tracer("").Start(ctx, "ping.tracker.SetFailed")
	defer sp.End()

	sp.SetAttributes(
		attribute.String("tracker.id", tracker.ID),
	)

	oldState := tracker.PingDefinition.State
	tracker.PingDefinition.State = "failed"

	if oldState != "failed" {
		if err := tracker.updateConfig(ctx); err != nil {
			return fmt.Errorf("failed to update ping configuration: %w", err)
		}

		if err := tracker.insertPingRecord(ctx, time.Now(), true); err != nil {
			return fmt.Errorf("failed to create ping record: %w", err)
		}

		PingStateChanged.Fire(ctx, PingStateChangedPayload{
			PingDefinition: tracker.PingDefinition,
			From:           oldState,
		})
	}

	return nil
}

func (tracker *Tracker) Update(ctx context.Context, newTime time.Time) error {
	ctx, sp := otel.Tracer("").Start(ctx, "ping.tracker.Update")
	defer sp.End()

	sp.SetAttributes(
		attribute.String("new_time", newTime.String()),
		attribute.String("tracker.id", tracker.ID),
	)

	tracker.lock.Lock()
	defer tracker.lock.Unlock()

	updateConfig := false

	currentState := tracker.PingDefinition.State
	logger.From(ctx).Infof("healthchecks: updating with time %s (zero=%v)", newTime, newTime.IsZero())

	if !newTime.IsZero() {
		logger.From(ctx).Infof("healthchecks: ping-%s: last ping at %s with %s between pings", tracker.ID, newTime, newTime.Sub(tracker.lastTime))
		tracker.lastTime = newTime

		if err := tracker.insertPingRecord(ctx, newTime, false); err != nil {
			return fmt.Errorf("failed to update ping record: %w", err)
		}
		updateConfig = true
	}

	newState := tracker.evaluateState()

	// only update if the state changed to a failure mode or if we just received
	// a new ping.
	if (newState != tracker.PingDefinition.State && newState != "passed") || !newTime.IsZero() {
		tracker.PingDefinition.State = newState
	}

	logger.From(ctx).Infof("healthchechks: ping-%s: old-state = %q, new-state = %q", tracker.Name, currentState, tracker.PingDefinition.State)

	// fire an event if we changed state and create a "FAIL" ping record
	if currentState != tracker.PingDefinition.State {
		// only create a new record
		if newState == "failed" && newTime.IsZero() {
			if err := tracker.insertPingRecord(ctx, time.Now(), true); err != nil {
				return fmt.Errorf("failed to update ping record: %w", err)
			}
		}

		PingStateChanged.Fire(ctx, PingStateChangedPayload{
			PingDefinition: tracker.PingDefinition,
			From:           currentState,
		})
		updateConfig = true
	}

	if updateConfig {
		if err := tracker.updateConfig(ctx); err != nil {
			return fmt.Errorf("failed to update ping configuration: %w", err)
		}
	}

	return nil
}

func (tracker *Tracker) evaluateState() string {
	threshold := time.Now().Add(-tracker.ExpectedInterval)
	switch {
	case threshold.After(tracker.lastTime.Add(tracker.GracePeriod)):
		return "failed"
	case threshold.After(tracker.lastTime):
		return "late"
	}

	return "passed"
}

func (tracker *Tracker) updateConfig(ctx context.Context) error {
	state := tracker.PingDefinition.State

	currentValue, err := tracker.configDB.GetID(ctx, tracker.ID)
	if err != nil {
		return fmt.Errorf("failed to get ping by id %s: %w", tracker.ID, err)
	}

	logger.From(ctx).Infof("healthchecks: updating ping configuration %s with new state %s", tracker.ID, state)

	newOpts := confutil.SetOption(currentValue.Options, "State", state)
	newOpts = confutil.SetOption(newOpts, "LastPingReceived", tracker.lastTime.Format(time.RFC3339))

	ctx = context.WithValue(ctx, ignorePingUpdateContextKey{}, true)

	if err := tracker.configDB.Update(ctx, tracker.ID, "healthchecks", newOpts); err != nil {
		return fmt.Errorf("failed to update ping in configuration %s: %w", tracker.ID, err)
	}

	return nil
}

func (tracker *Tracker) insertPingRecord(ctx context.Context, t time.Time, failed bool) error {
	pingOid, err := primitive.ObjectIDFromHex(tracker.ID)
	if err != nil {
		return fmt.Errorf("failed to parse object ID %s: %w", tracker.ID, err)
	}

	if _, err := tracker.pings.InsertOne(ctx, PingRecord{
		PingID: pingOid,
		Time:   t,
		Fail:   failed,
	}); err != nil {
		return err
	}

	return nil
}
