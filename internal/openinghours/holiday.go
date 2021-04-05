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

// HolidayGetter allows to retrieve holidays.
type HolidayGetter interface {
	// Get returns a list of public holidays for the given
	// country and year.
	Get(ctx context.Context, country string, year int) ([]PublicHoliday, error)

	// IsHoliday returns true if d is a public holiday in
	// country.
	IsHoliday(ctx context.Context, country string, d time.Time) (bool, error)
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

// Is checks if p is on d.
func (p *PublicHoliday) Is(d time.Time) bool {
	return fmt.Sprintf("%d-%02d-%02d", d.Year(), d.Month(), d.Day()) == p.Date
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

	log.From(ctx).Infof("loaded holidays for %s in %d: %+v", country, year, result)

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
func (cache *HolidayCache) Get(ctx context.Context, country string, year int) ([]PublicHoliday, error) {
	log := log.From(ctx)
	cache.rw.RLock()

	if entry, ok := cache.cache[fmt.Sprintf("%s-%d", country, year)]; ok {
		defer cache.rw.RUnlock()
		log.Infof("Using cache entry for holidays in %s at %d", country, year)

		if entry.Loaded.Before(time.Now().Add(time.Hour * -24)) {
			log.Infof("Re-fetching holidays for %s in %d", country, year)
			go func() {
				_, err := cache.load(country, year)
				if err != nil {
					log.Errorf("failed to re-fetch holidays: %s", err)
				}
			}()
		}

		return entry.PublicHolidays, nil
	}

	cache.rw.RUnlock()

	log.Infof("Fetching holidays for %s in %d", country, year)
	e, err := cache.load(country, year)
	if err != nil {
		return nil, err
	}
	return e.PublicHolidays, nil
}

// IsHoliday returns true if d is a public holiday in country.
func (cache *HolidayCache) IsHoliday(ctx context.Context, country string, d time.Time) (bool, error) {
	holidays, err := cache.Get(ctx, country, d.Year())
	if err != nil {
		return false, err
	}

	for _, p := range holidays {
		if p.Is(d) {
			return true, nil
		}
	}

	return false, nil
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
