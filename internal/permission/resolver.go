package permission

import (
	"context"

	"github.com/tierklinik-dobersberg/cis/internal/database/identitydb"
	"github.com/tierklinik-dobersberg/cis/internal/schema"
	"github.com/tierklinik-dobersberg/logger"
)

// Resolver is used for resolving user and role
// permissions including direct and inherited
// permission sets.
type Resolver struct {
	db identitydb.Database
}

// NewResolver returns a new permission resolver.
func NewResolver(db identitydb.Database) *Resolver {
	return &Resolver{db}
}

// ResolveUserPermissions resolves all permissions that apply to a user.
// Permissions are returned in slices ordered as they should be evaluated.
// Permissions in the same slice have the same priority.
func (res *Resolver) ResolveUserPermissions(ctx context.Context, user string) ([][]schema.Permission, error) {
	var permissions [][]schema.Permission
	countDirect := 0
	countIndirect := 0

	// start with user permissions
	directUserPermissions, err := res.db.GetUserPermissions(ctx, user)
	if err != nil {
		return nil, err
	}
	permissions = append(permissions, directUserPermissions)
	countDirect += len(directUserPermissions)

	// get the user object
	userObj, err := res.db.GetUser(ctx, user)
	if err != nil {
		return nil, err
	}

	// collect permissions of direct roles
	var rolePermissions []schema.Permission
	for _, roleName := range userObj.Roles {
		rolePerms, err := res.db.GetRolePermissions(ctx, roleName)
		if err != nil {
			return nil, err
		}

		countIndirect += len(rolePerms)
		rolePermissions = append(rolePermissions, rolePerms...)
	}

	if len(rolePermissions) > 0 {
		permissions = append(permissions, rolePermissions)
	}

	log.From(ctx).WithFields(logger.Fields{
		"total":     countIndirect + countDirect,
		"direct":    countDirect,
		"inherited": countIndirect,
		"user":      user,
	}).Infof("resolved permissions for user")

	return permissions, nil
}
