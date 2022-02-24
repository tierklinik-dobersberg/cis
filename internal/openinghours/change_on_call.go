package openinghours

import (
	"fmt"
	"time"

	"github.com/tierklinik-dobersberg/cis/pkg/daytime"
)

type ChangeOnCall struct {
	SourceDayStart   string
	SourceNightStart string

	dayStart   daytime.DayTime
	nightStart daytime.DayTime
	loc        *time.Location
}

func (coc ChangeOnCall) String() string {
	return fmt.Sprintf("ChangeOnCall<day=%s from %s night=%s from %s>", coc.dayStart, coc.SourceDayStart, coc.nightStart, coc.SourceNightStart)
}

func (coc ChangeOnCall) IsDayShift(t time.Time) bool {
	dayStart := coc.dayStart.At(t, coc.loc)
	nightStart := coc.nightStart.At(t, coc.loc)

	return (t.Equal(dayStart) || t.After(dayStart)) && t.Before(nightStart)
}

func (coc ChangeOnCall) IsNightShift(t time.Time) bool {
	return !coc.IsDayShift(t)
}

func (coc ChangeOnCall) DayStartAt(t time.Time) time.Time {
	return coc.dayStart.At(t, coc.loc)
}

func (coc ChangeOnCall) NightStartAt(t time.Time) time.Time {
	return coc.nightStart.At(t, coc.loc)
}

func (coc ChangeOnCall) IsApplicable(t time.Time) bool {
	dayStart := coc.DayStartAt(t)

	return dayStart.Before(t) || dayStart.Equal(t)
}
