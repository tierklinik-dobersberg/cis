package permission

import (
	"context"

	"github.com/tierklinik-dobersberg/cis/internal/cfgspec"
	"github.com/tierklinik-dobersberg/cis/internal/database/identitydb"
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
// Permissions in the same slice have the same priority. If additional roles
// are passed they will be appended to the end of the returned permission sets.
func (res *Resolver) ResolveUserPermissions(ctx context.Context, user string, additionalRoles []string) ([][]cfgspec.Permission, error) {
	var permissions [][]cfgspec.Permission

	// start with user permissions
	directUserPermissions, err := res.db.GetUserPermissions(ctx, user)
	if err != nil {
		return nil, err
	}
	permissions = append(permissions, directUserPermissions)

	// get the user object
	userObj, err := res.db.GetUser(ctx, user)
	if err != nil {
		return nil, err
	}

	// collect permissions of direct roles
	var rolePermissions []cfgspec.Permission
	for _, roleName := range userObj.Roles {
		rolePerms, err := res.db.GetRolePermissions(ctx, roleName)
		if err != nil {
			return nil, err
		}
		rolePermissions = append(rolePermissions, rolePerms...)
	}
	if len(rolePermissions) > 0 {
		permissions = append(permissions, rolePermissions)
	}

	// append any additional roles that are specified at the command
	// call.
	var extraRolePermissions []cfgspec.Permission
	for _, roleName := range additionalRoles {
		rolePerms, err := res.db.GetRolePermissions(ctx, roleName)
		if err != nil {
			return nil, err
		}
		extraRolePermissions = append(extraRolePermissions, rolePerms...)
	}
	if len(extraRolePermissions) > 0 {
		permissions = append(permissions, extraRolePermissions)
	}

	log.From(ctx).WithFields(logger.Fields{
		"total":     len(directUserPermissions) + len(rolePermissions) + len(extraRolePermissions),
		"direct":    len(directUserPermissions),
		"inherited": len(rolePermissions),
		"extra":     len(extraRolePermissions),
		"user":      user,
	}).Infof("resolved permissions for user")

	return permissions, nil
}
