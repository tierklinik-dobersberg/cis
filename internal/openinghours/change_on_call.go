package openinghours

import (
	"fmt"
	"time"

	"github.com/tierklinik-dobersberg/cis/pkg/daytime"
)

type ChangeOnCall struct {
	dayStart   daytime.DayTime
	nightStart daytime.DayTime
	loc        *time.Location
	weekday    time.Weekday
}

func (coc *ChangeOnCall) String() string {
	return fmt.Sprintf("ChangeOnCall<%s day=%s night=%s>", coc.weekday, coc.dayStart, coc.nightStart)
}

func (coc *ChangeOnCall) Weekday() time.Weekday { return coc.weekday }

func (coc *ChangeOnCall) IsDayShift(t time.Time) bool {
	dayStart := coc.dayStart.At(t, coc.loc)
	nightStart := coc.nightStart.At(t, coc.loc)
	return (t.Equal(dayStart) || t.After(dayStart)) && t.Before(nightStart)
}

func (coc *ChangeOnCall) IsNightShift(t time.Time) bool {
	return !coc.IsDayShift(t)
}

func (coc *ChangeOnCall) DayStartAt(t time.Time) time.Time {
	return coc.dayStart.At(t, coc.loc)
}

func (coc *ChangeOnCall) NightStartAt(t time.Time) time.Time {
	return coc.nightStart.At(t, coc.loc)
}

func (coc *ChangeOnCall) IsApplicable(t time.Time) bool {
	dayStart := coc.DayStartAt(t)
	return dayStart.Before(t) || dayStart.Equal(t)
}
