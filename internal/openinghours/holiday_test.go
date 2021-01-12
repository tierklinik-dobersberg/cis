package openinghours_test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/tierklinik-dobersberg/cis/internal/openinghours"
)

func TestLoadHolidays(t *testing.T) {
	ctx := context.Background()

	cache := openinghours.NewHolidayCache()
	res, err := cache.Get(ctx, "AT", 2021)
	assert.NoError(t, err)
	assert.NotNil(t, res)
	assert.Contains(t, res, openinghours.PublicHoliday{
		CountryCode: "AT",
		Date:        "2021-12-25",
		Fixed:       true,
		Global:      true,
		LocalName:   "Weihnachten",
		Name:        "Christmas Day",
		Type:        "Public",
	})

	isHoliday, err := cache.IsHoliday(ctx, "AT", time.Date(2021, time.December, 25, 0, 0, 0, 0, time.Local))
	assert.True(t, isHoliday)
	assert.NoError(t, err)

	isHoliday, err = cache.IsHoliday(ctx, "AT", time.Date(2021, time.August, 13, 0, 0, 0, 0, time.Local))
	assert.False(t, isHoliday)
	assert.NoError(t, err)
}
