package openinghours

import (
	"fmt"
	"time"

	"github.com/tierklinik-dobersberg/cis/pkg/daytime"
)

// OpeningHour describes a single business-open time range
// with an additional OpenBefore and CloseAfter threshold for the
// entry door.
type OpeningHour struct {
	daytime.Range

	Unofficial bool          `json:"unofficial"`
	Holiday    bool          `json:"holiday"`
	OpenBefore time.Duration `json:"closeBefore"`
	CloseAfter time.Duration `json:"closeAfter"`
}

// EffectiveOpen returns the duration from midnight at which
// the door should open.
func (oh OpeningHour) EffectiveOpen() time.Duration {
	return oh.From.AsDuration() - oh.OpenBefore
}

// EffectiveClose returns the duration from midnight at which
// the door should close.
func (oh OpeningHour) EffectiveClose() time.Duration {
	return oh.To.AsDuration() + oh.CloseAfter
}

func (oh OpeningHour) String() string {
	return fmt.Sprintf("<%s (-%s) - %s (+%s)>", oh.From, oh.OpenBefore, oh.To, oh.CloseAfter)
}

// OpeningHourSlice is a slice of opening hours used
// for sorting.
type OpeningHourSlice []OpeningHour

func (os OpeningHourSlice) Len() int { return len(os) }

func (os OpeningHourSlice) Less(i, j int) bool {
	return os[i].From.AsMinutes() < os[j].From.AsMinutes()
}

func (os OpeningHourSlice) Swap(i, j int) { os[i], os[j] = os[j], os[i] }
