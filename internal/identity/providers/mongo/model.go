package mongo

import "github.com/tierklinik-dobersberg/cis/internal/cfgspec"

type UserModel struct {
	cfgspec.User
	Permissions []cfgspec.Permission `bson:"permissions,omitempty"`
}

type RoleModel struct {
	cfgspec.Role
	Permissions []cfgspec.Permission `bson:"permissions,omitempty"`
}
