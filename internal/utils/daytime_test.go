package utils_test

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/tierklinik-dobersberg/cis/internal/utils"
)

func TestDayTimeParse(t *testing.T) {
	cases := []struct {
		In  string
		Out utils.DayTime
		Err bool
	}{
		{
			In:  "08:00",
			Out: utils.DayTime{8, 0},
		},
		{
			In:  "12:15",
			Out: utils.DayTime{12, 15},
		},
		{
			In:  "00:00",
			Out: utils.DayTime{0, 0},
		},
		{
			In:  "23:59",
			Out: utils.DayTime{23, 59},
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
		r, err := utils.ParseDayTime(c.In)
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
	cases := []struct {
		In  string
		Out utils.DayTimeRange
		Err bool
	}{
		{
			In: "08:00 - 12:00",
			Out: utils.DayTimeRange{
				From: utils.DayTime{8, 0},
				To:   utils.DayTime{12, 0},
			},
		},
		{
			In: "14:30-17:45",
			Out: utils.DayTimeRange{
				From: utils.DayTime{14, 30},
				To:   utils.DayTime{17, 45},
			},
		},
		{
			In:  "17:30-08:45",
			Err: true,
		},
	}

	for idx, c := range cases {
		r, err := utils.ParseDayTimeRange(c.In)
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
