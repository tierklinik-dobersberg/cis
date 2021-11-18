package daytime_test

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/tierklinik-dobersberg/cis/pkg/daytime"
)

func TestDayTimeParse(t *testing.T) {
	t.Parallel()

	cases := []struct {
		In  string
		Out daytime.DayTime
		Err bool
	}{
		{
			In:  "08:00",
			Out: daytime.DayTime{8, 0},
		},
		{
			In:  "12:15",
			Out: daytime.DayTime{12, 15},
		},
		{
			In:  "00:00",
			Out: daytime.DayTime{0, 0},
		},
		{
			In:  "23:59",
			Out: daytime.DayTime{23, 59},
		},
		{
			In:  "24:00",
			Err: true,
		},
		{
			In:  "00:-10",
			Err: true,
		},
		{
			In:  "00",
			Err: true,
		},
		{
			In:  "12:",
			Err: true,
		},
	}

	for idx, c := range cases {
		r, err := daytime.ParseDayTime(c.In)
		msg := fmt.Sprintf("in case %d (input: %s)", idx, c.In)
		if c.Err {
			assert.Error(t, err, msg)
			continue
		} else {
			assert.NoError(t, err, msg)
		}
		assert.Equal(t, c.Out, r, msg)
	}
}

func TestParseTimeRange(t *testing.T) {
	t.Parallel()

	cases := []struct {
		In  string
		Out daytime.Range
		Err bool
	}{
		{
			In: "08:00 - 12:00",
			Out: daytime.Range{
				From: daytime.DayTime{8, 0},
				To:   daytime.DayTime{12, 0},
			},
		},
		{
			In: "14:30-17:45",
			Out: daytime.Range{
				From: daytime.DayTime{14, 30},
				To:   daytime.DayTime{17, 45},
			},
		},
		{
			In:  "17:30-08:45",
			Err: true,
		},
	}

	for idx, c := range cases {
		r, err := daytime.ParseRange(c.In)
		msg := fmt.Sprintf("in case %d (input: %q)", idx, c.In)
		if c.Err {
			assert.Error(t, err, msg)
			continue
		} else {
			assert.NoError(t, err, msg)
		}
		assert.Equal(t, c.Out, r, msg)
	}
}
