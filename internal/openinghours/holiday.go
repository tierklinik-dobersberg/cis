package openinghours

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

const apiHostFormat = "https://date.nager.at/Api/v2/PublicHolidays/%d/%s"

func apiURL(country string, year int) string {
	return fmt.Sprintf(apiHostFormat, year, country)
}

/*

{
	"date": "2020-12-28",
	"localName": "string",
	"name": "string",
	"countryCode": "string",
	"fixed": true,
	"global": true,
	"counties": [
	"string"
	],
	"launchYear": 0,
	"type": "Public"
}

*/

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
