package mongo

import (
	"github.com/tierklinik-dobersberg/cis/internal/cfgspec"
	"github.com/tierklinik-dobersberg/cis/internal/identity"
)

type UserModel struct {
	identity.User `bson:",inline"`
	Permissions   []cfgspec.Permission `bson:"permissions,omitempty"`
}

type RoleModel struct {
	identity.Role `bson:",inline"`
	Permissions   []cfgspec.Permission `bson:"permissions,omitempty"`
}
