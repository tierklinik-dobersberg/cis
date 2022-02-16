package runtime

import "github.com/ppacher/system-conf/conf"

// OverviewFields returns a schema annotation that marks
// one or more fields for use in "overviews" like when displaying
// section instances in a table layout.
func OverviewFields(fields ...string) conf.KeyValue {
	return conf.KeyValue{
		Key:   "vet.dobersberg.cis:schema/overviewFields",
		Value: fields,
	}
}
