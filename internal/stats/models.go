package stats

import "time"

// TimedValue represents a single entry in a TimeSeries.
type TimedValue struct {
	// Time is the time/date of the value.
	Time time.Time `json:"time"`

	// Value is the actual amount.
	Value int `json:"value"`

	// Name is the name of the data point.
	Name string `json:"name"`

	// Labels may be used to separate different value streams
	// or to perform additional grouping.
	Labels map[string]interface{} `json:"labels"`
}

// TimeSeries represents a single time series.
type TimeSeries struct {
	// ID is the ID of the time-series.
	ID string `json:"id"`

	// Name is human readable name of the time series. Defaults to ID if empty.
	Name string `json:"name"`

	// Values are the values of the times series and are ordered by time.
	Series []TimedValue `json:"series"`
}
