package execer

import (
	"context"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/pkg/multierr"
	"github.com/tierklinik-dobersberg/cis/runtime/event"
	"github.com/tierklinik-dobersberg/cis/runtime/trigger"
	"github.com/tierklinik-dobersberg/service/runtime"
)

type eventHandler struct {
	execer Execer
}

func (eh *eventHandler) HandleEvents(ctx context.Context, evts ...*event.Event) error {
	errors := new(multierr.Error)
	for _, e := range evts {
		if err := eh.execer.Run(ctx, e); err != nil {
			errors.Add(err)
			log.From(ctx).Errorf("failed to run command: %s", err)
		}
	}
	return errors.ToError()
}

func AddTriggerType(name string, reg *trigger.Registry) error {
	return reg.RegisterType(name, &trigger.Type{
		OptionRegistry: ExecerSpec,
		CreateFunc: func(c context.Context, _ *runtime.ConfigSchema, s *conf.Section) (trigger.Handler, error) {
			var e Execer
			if err := conf.DecodeSections([]conf.Section{*s}, ExecerSpec, &e); err != nil {
				return nil, err
			}

			return &eventHandler{execer: e}, nil
		},
	})
}
