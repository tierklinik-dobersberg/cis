package mongo

import "github.com/tierklinik-dobersberg/cis/internal/cfgspec"

type user struct {
	cfgspec.User
	Permissions []cfgspec.Permission `bson:"permissions,omitempty"`
}

type role struct {
	cfgspec.Role
	Permissions []cfgspec.Permission `bson:"permissions,omitempty"`
}
