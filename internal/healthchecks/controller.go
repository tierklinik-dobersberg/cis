package healthchecks

import (
	"context"
	"fmt"
	"io"
	"sync"
	"time"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/utils"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/pkg/trace"
	"github.com/tierklinik-dobersberg/cis/runtime"
	"github.com/tierklinik-dobersberg/logger"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type ignorePingUpdateContextKey struct{}

type (
	PingDefinition struct {
		ID               string `option:"_id"`
		Name             string
		Description      string
		Comment          string
		ExpectedInterval time.Duration
		GracePeriod      time.Duration
		Public           bool
		Tags             []string
		State            string
		LastPingReceived string
	}

	PingRecord struct {
		ID     primitive.ObjectID `bson:"_id,omitempty" json:"_id"`
		PingID primitive.ObjectID `bson:"pingID,omitempty" json:"pingID"`
		Time   time.Time          `bson:"createdAt,omitempty" json:"createdAt"`
		Fail   bool               `bson:"fail,omitempty" json:"fail"`
	}

	Controller struct {
		wg        sync.WaitGroup
		startOnce sync.Once
		pings     *mongo.Collection
		configDB  *runtime.ConfigSchema

		lock     sync.Mutex
		trackers map[string]*Tracker
	}
)

var (
	PingsCollection = "hc-pings"

	PingDefinitionSpec = conf.SectionSpec{
		{
			Name:        "Name",
			Description: "The name fo the ping definition. Will be used in the trigger URL at \"/api/hc/v1/ping/{{ name }}\". A random identifier will be generated if left empty.",
			Required:    false,
			Type:        conf.StringType,
			Annotations: new(conf.Annotation).With(
				runtime.Unique(),
			),
		},
		{
			Name:        "Description",
			Description: "A human readable description of the ping",
			Type:        conf.StringType,
		},
		{
			Name:        "Comment",
			Description: "An additional comment about the ping",
			Type:        conf.StringType,
		},
		{
			Name:        "ExpectedInterval",
			Description: "The allowed time between each pings",
			Required:    true,
			Type:        conf.DurationType,
		},
		{
			Name:        "GracePeriod",
			Description: "A optional period that the ping can be late before a warning is fired",
			Required:    true,
			Type:        conf.DurationType,
		},
		{
			Name:        "Public",
			Description: "Whether or not this tracker is visible on the public status page",
			Type:        conf.BoolType,
			Default:     "no",
		},
		{
			Name:        "Tags",
			Description: "A list of tags used to group checks together",
			Type:        conf.StringSliceType,
			Annotations: new(conf.Annotation).With(
				runtime.OneOfRef("healthchecks", "Tags", "Tags", true),
			),
		},
		{
			Name:        "State",
			Description: "The current state of the ping. Can be 'passed', 'late' or 'failed'",
			Required:    false,
			Type:        conf.StringType,
			Annotations: new(conf.Annotation).With(
				runtime.Readonly(),
				runtime.OneOf(
					runtime.PossibleValue{
						Display: "Passed",
						Value:   "passed",
					},
					runtime.PossibleValue{
						Display: "Late",
						Value:   "late",
					},
					runtime.PossibleValue{
						Display: "Failed",
						Value:   "failed",
					},
				),
			),
		},
		{
			Name:        "LastPingReceived",
			Type:        conf.StringType,
			Description: "Time of the last received ping",
			Annotations: new(conf.Annotation).With(
				runtime.Readonly(),
			),
		},
	}
)

func (def PingDefinition) String() string {
	return fmt.Sprintf("PingDef %s (name = %s, state = %s)", def.ID, def.Name, def.State)
}

// NewController returns a new healthchecks controller that stores and retrieves
// check definitions from configDb.
func NewController(ctx context.Context, dbName string, client *mongo.Client, configDB *runtime.ConfigSchema) (*Controller, error) {
	if err := configDB.Register(
		runtime.Schema{
			Name:        "healthchecks",
			DisplayName: "Healthchecks",
			Description: "Configure healthchecks to monitor your infrastructure",
			Multi:       true,
			Category:    "Integration",
			SVGData: `<path stroke-linecap="round" stroke-linejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
  							<path stroke-linecap="round" stroke-linejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />`,
			Spec: PingDefinitionSpec,
			Annotations: new(conf.Annotation).With(
				runtime.OverviewFields("Name", "Description", "ExpectedInterval", "GracePeriod", "State"),
			),
		},
	); err != nil {
		return nil, err
	}

	ctrl := &Controller{
		configDB: configDB,
		pings:    client.Database(dbName).Collection(PingsCollection),
		trackers: make(map[string]*Tracker),
	}
	configDB.AddNotifier(ctrl, "healthchecks")

	var all []PingDefinition
	if err := configDB.DecodeSection(ctx, "healthchecks", &all); err != nil {
		return nil, fmt.Errorf("failed to load current configurations: %w", err)
	}

	ctrl.lock.Lock()
	defer ctrl.lock.Unlock()

	for idx := range all {
		p := all[idx]

		tracker, err := NewTracker(ctx, p, ctrl.configDB, ctrl.pings)
		if err != nil {
			logger.From(ctx).Errorf("healthchecks: failed to create tracker for ping %s: %s", p, err)
		} else {
			ctrl.trackers[p.Name] = tracker
			logger.From(ctx).Infof("healthchecks: setting up ping %q with id %s", p.Name, p.ID)
		}
	}

	return ctrl, nil
}

func (ctrl *Controller) Start(ctx context.Context) {
	ctrl.startOnce.Do(func() {
		ctrl.wg.Add(1)
		go func() {
			defer ctrl.wg.Done()

			for {
				ctrl.updatePings(ctx)

				select {
				case <-ctx.Done():
					return
				case <-time.After(5 * time.Second):
				}
			}
		}()
	})
}

func (ctrl *Controller) updatePings(ctx context.Context) {
	ctrl.lock.Lock()
	defer ctrl.lock.Unlock()

	for _, p := range ctrl.trackers {
		if err := p.Update(ctx, time.Time{}); err != nil {
			logger.From(ctx).Errorf("failed to update ping tracker for %s (%s): %s", p.Name, p.ID, err)
		}
		logger.From(ctx).Infof("updated healthcheck ping %s (%s), state %s", p.Name, p.ID, p.State())
	}
}

func (ctrl *Controller) FindPingRecords(ctx context.Context, name string, from, to time.Time) ([]PingRecord, error) {
	createdAtFilter := make(bson.M)
	if !from.IsZero() {
		createdAtFilter["$gte"] = from
	}
	if !to.IsZero() {
		createdAtFilter["$lte"] = to
	}

	filter := make(bson.M)
	if len(createdAtFilter) > 0 {
		filter["createdAt"] = createdAtFilter
	}

	res, err := ctrl.pings.Find(
		ctx,
		filter,
		options.Find().SetSort(bson.M{"createdAt": 1}),
	)
	if err != nil {
		return nil, err
	}

	var result []PingRecord
	if err := res.All(ctx, &result); err != nil {
		return nil, err
	}

	return result, nil
}

func (ctrl *Controller) NotifyChange(ctx context.Context, changeType, id string, sec *conf.Section) error {
	if val := ctx.Value(ignorePingUpdateContextKey{}); val != nil {
		return nil
	}

	ctrl.lock.Lock()
	defer ctrl.lock.Unlock()

	if changeType != runtime.ChangeTypeCreate {
		delete(ctrl.trackers, id)
	}

	if changeType == runtime.ChangeTypeDelete {
		return nil
	}

	var def PingDefinition

	if err := conf.DecodeSections(
		[]conf.Section{*sec},
		PingDefinitionSpec,
		&def,
	); err != nil {
		return err
	}
	def.ID = id

	if def.Name == "" {
		updCtx := context.WithValue(ctx, ignorePingUpdateContextKey{}, true)
		randomName, _ := utils.Nonce(8)
		def.Name = randomName

		if err := ctrl.configDB.Update(updCtx, id, "healthchecks", append(sec.Options, conf.Option{
			Name:  "Name",
			Value: randomName,
		})); err != nil {
			trace.RecordAndLog(ctx, fmt.Errorf("failed to store random name for ping %s: %w", id, err), "ping.id", id)
		}
	}

	if ctrl.trackers == nil {
		ctrl.trackers = make(map[string]*Tracker)
	}

	tracker, err := NewTracker(ctx, def, ctrl.configDB, ctrl.pings)
	if err != nil {
		return err
	}

	ctrl.trackers[def.Name] = tracker

	return nil
}

func (ctrl *Controller) FailPing(ctx context.Context, name string) error {
	ctrl.lock.Lock()
	defer ctrl.lock.Unlock()

	ping, ok := ctrl.trackers[name]
	if !ok {
		return httperr.NotFound("healthcheck ping", name)
	}

	return ping.SetFailed(ctx)
}

func (ctrl *Controller) PingReceived(ctx context.Context, name string, payload io.Reader) error {
	ctrl.lock.Lock()
	defer ctrl.lock.Unlock()

	ping, ok := ctrl.trackers[name]
	if !ok {
		return httperr.NotFound("healthcheck ping", name)
	}

	if err := ping.Update(ctx, time.Now()); err != nil {
		return err
	}

	return nil
}
