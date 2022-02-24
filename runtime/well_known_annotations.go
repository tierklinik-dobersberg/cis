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

// PossibleValue describes an allowed value for a configuration
// option. PossibleValues are used for "select" components in a user
// interface.
type PossibleValue struct {
	Display string      `json:"display"`
	Value   interface{} `json:"value"`
}

type OneOfReference struct {
	// SchemaType is the name of the schema that
	// holds possible values.
	SchemaType string `json:"schemaType"`
	// ValueField is the name of the field in the referenced
	// schema.
	ValueField string `json:"valueField"`
	// DisplayFiled is the name fo the field that should be diplayed
	// in the user interface.
	DisplayField string `json:"displayField,omitempty"`
}

// OneOfAnnotation is used to describe a "select" type of
// configuration option.
type OneOfAnnotation struct {
	Values []PossibleValue `json:"values,omitempty"`
}

// OneOf returns a new KeyValue for a OneOfAnnotation conf.Option
// with it's allowe .Values member set to values.
func OneOf(values ...PossibleValue) conf.KeyValue {
	return conf.KeyValue{
		Key: "vet.dobersberg.cis:schema/oneOf",
		Value: OneOfAnnotation{
			Values: values,
		},
	}
}

// OneOfRef returns a new KeyValue for a OneOfReference conf.Option annotation.
func OneOfRef(ref, valueField, displayField string) conf.KeyValue {
	return conf.KeyValue{
		Key: "vet.dobersberg.cis:schema/oneOf",
		Value: OneOfReference{
			SchemaType:   ref,
			ValueField:   valueField,
			DisplayField: displayField,
		},
	}
}

// Unique marks each field name passed as unique. This may be useful to
// enforce unique names accros configuration instances.
func Unique(uniqueFields ...string) conf.KeyValue {
	return conf.KeyValue{
		Key:   "vet.dobersberg.cis:schema/unqiueFields",
		Value: uniqueFields,
	}
}

type OnlyWhenValueAnnotation struct {
	Field string `json:"field"`
	Value string `json:"value"`
}

// OnlyWhenValue annotates a conf.Option to be only considered relevant in
// case the option optionName is set to valueCondition.
func OnlyWhenValue(optionName, valueCondition string) conf.KeyValue {
	return conf.KeyValue{
		Key:   "vet.dobersberg.cis:schema/onlyWhenValue",
		Value: valueCondition,
	}
}

var (
	OneOfRoles = OneOfRef("identity:roles", "name", "")
)

var (
	IDRef = "_id"
)
