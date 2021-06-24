package importer

import "time"

type ImportFinsihedEvent struct {
	Importer string
	Time     time.Time
	Data     interface{}
	Error    string
}

type ImportStartedEvent struct {
	Importer string
	Time     time.Time
}
