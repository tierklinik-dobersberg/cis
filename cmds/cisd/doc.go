package main

import (
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/cfgspec"
	"github.com/tierklinik-dobersberg/cis/pkg/confutil"
)

var globalConfigFile = conf.FileSpec{
	"Global": confutil.MultiOptionRegistry{
		cfgspec.ConfigSpec,
	},
	"CORS": CORSSpec,
}

// CORSSpec defines the specification for parsing into CORS.
var CORSSpec = conf.SectionSpec{
	{
		Name:        "AllOrigins",
		Description: "Wether or not all origins should be allowed",
		Default:     "no",
		Type:        conf.BoolType,
	},
	{
		Name:        "AllowOrigins",
		Description: "AllowOrigins is a list of origins a cross-domain request can be executed from. If the special '*' value is present in the list, all origins will be allowed.",
		Type:        conf.StringSliceType,
	},
	{
		Name:        "AllowMethods",
		Aliases:     []string{"AllowVerbs"},
		Description: "AllowMethods is a list of methods the client is allowed to use with cross-domain requests.",
		Type:        conf.StringSliceType,
	},
	{
		Name:        "AllowHeaders",
		Description: "AllowHeaders is list of non simple headers the client is allowed to use with cross-domain requests.",
		Type:        conf.StringSliceType,
	},
	{
		Name:        "AllowCredentials",
		Description: "AllowCredentials indicates whether the request can include user credentials like cookies, HTTP authentication or client side SSL certificates.",
		Type:        conf.BoolType,
		Default:     "no",
	},
	{
		Name:        "ExposeHeaders",
		Type:        conf.StringSliceType,
		Description: "ExposedHeaders indicates which headers are safe to expose to the API of a CORS API specification.",
	},
	{
		Name:        "AllowWildcard",
		Type:        conf.BoolType,
		Description: "Allows to add origins like http://some-domain/*, https://api.* or http://some.*.subdomain.com",
	},
	{
		Name:        "AllowWebSockets",
		Type:        conf.BoolType,
		Description: "Allows usage of WebSocket protocol",
	},
	{
		Name:        "MaxAge",
		Description: "How long the client is allowed to cache preflight requests",
		Type:        conf.StringType,
		Default:     "12h",
	},
}
