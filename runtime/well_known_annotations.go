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
	// AllowCustomValue can be set to true if custom values
	// should also be allowed for the annoated option.
	AllowCustomValue bool `json:"allowCustomValue"`
}

// OneOfAnnotation is used to describe a "select" type of
// configuration option.
type OneOfAnnotation struct {
	Values []PossibleValue `json:"values,omitempty"`
	// AllowCustomValue can be set to true if custom values
	// should also be allowed for the annoated option.
	AllowCustomValue bool `json:"allowCustomValue"`
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

// OneOfWithCustom returns a new KeyValue for a OneOfAnnotation conf.Option
// with it's allowe .Values member set to values. This annoation also allows
// for custom values.
func OneOfWithCustom(values ...PossibleValue) conf.KeyValue {
	return conf.KeyValue{
		Key: "vet.dobersberg.cis:schema/oneOf",
		Value: OneOfAnnotation{
			Values:           values,
			AllowCustomValue: true,
		},
	}
}

// OneOfRef returns a new KeyValue for a OneOfReference conf.Option annotation.
func OneOfRef(ref, valueField, displayField string, allowCustomValue ...bool) conf.KeyValue {
	return conf.KeyValue{
		Key: "vet.dobersberg.cis:schema/oneOf",
		Value: OneOfReference{
			SchemaType:       ref,
			ValueField:       valueField,
			DisplayField:     displayField,
			AllowCustomValue: len(allowCustomValue) > 0 && allowCustomValue[0],
		},
	}
}

// Readonly returns a new Keyvalue that marks an entity as read-only.
func Readonly() conf.KeyValue {
	return conf.KeyValue{
		Key:   "vet.dobersberg.cis:schema/readonly",
		Value: true,
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

type StringFormatAnnotation struct {
	// Format defines the format of the annotated string
	// value.
	//
	// Valid values are:
	//
	//	- text/plain
	//	- text/markdown
	//	- application/json
	//
	Format string `json:"format"`
}

func StringFormat(format string) conf.KeyValue {
	return conf.KeyValue{
		Key: "vet.dobersberg.cis:schema/stringFormat",
		Value: StringFormatAnnotation{
			Format: format,
		},
	}
}

var (
	OneOfRoles = OneOfRef("identity:roles", "name", "")
	OneOfUsers = OneOfRef("identity:users", "name", "")
)

var (
	IDRef = "_id"
)
