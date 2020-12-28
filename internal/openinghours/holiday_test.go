package openinghours_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/tierklinik-dobersberg/cis/internal/openinghours"
)

func TestLoadHolidays(t *testing.T) {
	cache := openinghours.NewHolidayCache()
	res, err := cache.Get("AT", 2021)
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
}
