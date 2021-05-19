package cctv

import "github.com/ppacher/system-conf/conf"

// Camera describes an IP camera and how the camera stream
// can be accessed (source).
type Camera struct {
	Meta        CameraMeta   `section:"Camera"`
	MJPEGSource *MJPEGSource `section:"MJPEGSource"`
}

// CameraMeta holds meta-information about security/IP cameras.
type CameraMeta struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Location    string `json:"location"`
	Type        string `json:"type"`
}

// CameraMetaSpec defines the section spec for CameraMeta.
var CameraMetaSpec = conf.SectionSpec{
	{
		Name:        "Name",
		Description: "A human readable name of the camera",
		Required:    true,
		Type:        conf.StringType,
	},
	{
		Name:        "Description",
		Description: "A human readable description of the camera",
		Type:        conf.StringType,
	},
	{
		Name:        "Location",
		Description: "A freeform text for the location of the camera.",
		Type:        conf.StringType,
	},
	{
		Name:        "Type",
		Description: "A freeform text to describe the type of camera.",
		Type:        conf.StringType,
	},
}
