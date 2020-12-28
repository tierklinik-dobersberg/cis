package openinghours

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"
)

const apiHostFormat = "https://date.nager.at/Api/v2/PublicHolidays/%d/%s"

func apiURL(country string, year int) string {
	return fmt.Sprintf(apiHostFormat, year, country)
}

// HolidayGetter returns a list of public holidays for the given
// country and year.
type HolidayGetter interface {
	Get(country string, year int) ([]PublicHoliday, error)
}

// PublicHoliday represents a public holiday record returned by date.nager.at
type PublicHoliday struct {
	Date        string `json:"date"`
	LocalName   string `json:"localName"`
	Name        string `json:"name"`
	CountryCode string `json:"countryCode"`
	Fixed       bool   `json:"fixed"`
	Global      bool   `json:"global"`

	// Type may be  Public, Bank, School, Authorities, Optional, Observance
	Type string `json:"type"`
}

// LoadHolidays loads all public holidays for the given country and year
// from the Nager Holiday API. Users should cache the response as it won't
// change for the given year anyway.
func LoadHolidays(ctx context.Context, country string, year int) ([]PublicHoliday, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", apiURL(country, year), nil)
	if err != nil {
		return nil, err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status: %s", resp.Status)
	}

	var result []PublicHoliday
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result, nil
}

type cacheEntry struct {
	PublicHolidays []PublicHoliday
	Loaded         time.Time
}

// HolidayCache can load holidays for countries and supports
// caching the results.
type HolidayCache struct {
	call singleflight.Group

	rw    sync.RWMutex
	cache map[string]*cacheEntry
}

// NewHolidayCache returns a new holiday cache.
func NewHolidayCache() *HolidayCache {
	return &HolidayCache{
		cache: make(map[string]*cacheEntry),
	}
}

// Get returns a list of public holidays for the given two-letter ISO country code
// in the given year. If the holidays have already been loaded they are served from
// cache.
func (cache *HolidayCache) Get(country string, year int) ([]PublicHoliday, error) {
	cache.rw.RLock()

	if entry, ok := cache.cache[fmt.Sprintf("%s-%d", country, year)]; ok {
		defer cache.rw.RUnlock()

		if entry.Loaded.Before(time.Now().Add(time.Hour * -24)) {
			go cache.load(country, year)
		}

		return entry.PublicHolidays, nil
	}

	cache.rw.RUnlock()

	e, err := cache.load(country, year)
	if err != nil {
		return nil, err
	}
	return e.PublicHolidays, nil
}

// load loads the public holidays for country and year and makes sure no more than one HTTP
// request is executed for each combination at any time.
func (cache *HolidayCache) load(country string, year int) (*cacheEntry, error) {
	key := fmt.Sprintf("%s-%d", country, year)

	result, err, _ := cache.call.Do(key, func() (interface{}, error) {
		return LoadHolidays(context.Background(), country, year)
	})

	if err != nil {
		return nil, err
	}

	e := &cacheEntry{
		PublicHolidays: result.([]PublicHoliday),
		Loaded:         time.Now(),
	}

	cache.rw.Lock()
	defer cache.rw.Unlock()

	cache.cache[key] = e
	return e, nil
}
