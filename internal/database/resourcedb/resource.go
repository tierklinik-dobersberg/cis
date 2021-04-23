package resourcedb

import "github.com/ppacher/system-conf/conf"

// Resource represents some resource that has limited availability
// and might need coordination on it's use.
// Examples for resources in a veterinary clinc might be X-Rays,
// surgery rooms or a dental station. They can be "rented" or "locked"
// for specific times or until they are manually released.
type Resource struct {
	// ID is the actual ID of the resource and should not be changed
	// once the resource has be used. For resources created from
	// .resource files, the ID is the name of the file.
	ID string `json:"id" option:"-"`

	// Name is the human readable name of the resource and should
	// uniquely identify that resource.
	Name string `json:"name,omitempty"`

	// Description is a human readable description of the resource.
	Description string `json:"description,omitempty"`

	// Location might be used to specify the physical location of
	// the resource.
	Location string `json:"location,omitempty"`

	// MaxConcurrentUse specifies the maximum number of times
	// the resource can be used concurrently. This defaults to 1.
	MaxConcurrentUse int `json:"maxConcurrentUse,omitempty"`
}

// ResourceSpec defines the config stanzas that can be used to
// describe a resource in the [Resource] section.
var ResourceSpec = conf.SectionSpec{
	{
		Name:        "Name",
		Description: "The name of the resource used to uniquely identify it.",
		Required:    true,
		Type:        conf.StringType,
	},
	{
		Name:        "Description",
		Description: "A human readable description of the resource.",
		Type:        conf.StringType,
	},
	{
		Name:        "Location",
		Description: "A human readable description of the physical location of the resource.",
		Type:        conf.StringType,
	},
	{
		Name:        "MaxConcurrentUse",
		Description: "The maximum number of times the resource can be used concurrently. Defaults to 1",
		Default:     "1",
		Type:        conf.IntType,
	},
}
