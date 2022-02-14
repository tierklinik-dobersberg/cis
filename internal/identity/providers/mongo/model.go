package mongo

import "github.com/tierklinik-dobersberg/cis/internal/cfgspec"

type UserModel struct {
	cfgspec.User `bson:",inline"`
	Permissions  []cfgspec.Permission `bson:"permissions,omitempty"`
}

type RoleModel struct {
	cfgspec.Role `bson:",inline"`
	Permissions  []cfgspec.Permission `bson:"permissions,omitempty"`
}
