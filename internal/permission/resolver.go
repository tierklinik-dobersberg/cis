package permission

import (
	"context"
	"fmt"

	idmv1 "github.com/tierklinik-dobersberg/apis/gen/go/tkd/idm/v1"
	"github.com/tierklinik-dobersberg/cis/internal/identity"
	"github.com/tierklinik-dobersberg/logger"
	"go.opentelemetry.io/otel/trace"
)

// Resolver is used for resolving user and role
// permissions including direct and inherited
// permission sets.
type Resolver struct {
	db identity.Provider
}

// NewResolver returns a new permission resolver.
func NewResolver(db identity.Provider) *Resolver {
	return &Resolver{db}
}

// ResolveUserPermissions resolves all permissions that apply to a user.
// Permissions are returned in slices ordered as they should be evaluated.
// Permissions in the same slice have the same priority. If additional roles
// are passed they will be appended to the end of the returned permission sets.
func (res *Resolver) ResolveUserPermissions(ctx context.Context, user string, additionalRoles []*idmv1.Role) ([][]identity.Permission, error) {
	var permissions [][]identity.Permission

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
	var rolePermissions []identity.Permission
	for _, roleName := range userObj.Roles {
		rolePerms, err := res.db.GetRolePermissions(ctx, roleName)
		if err != nil {
			err = fmt.Errorf("failed to load permissions for role %s: %w", roleName, err)
			trace.SpanFromContext(ctx).RecordError(err)
			logger.From(ctx).Errorf(err.Error())

			continue
		}
		rolePermissions = append(rolePermissions, rolePerms...)
	}
	if len(rolePermissions) > 0 {
		permissions = append(permissions, rolePermissions)
	}

	// append any additional roles that are specified at the command
	// call.
	var extraRolePermissions []identity.Permission
	for _, role := range additionalRoles {
		rolePerms, err := res.db.GetRolePermissions(ctx, role.Id)
		if err != nil {
			err = fmt.Errorf("failed to load permissions for extra session role %s: %w", role.Id, err)
			trace.SpanFromContext(ctx).RecordError(err)
			logger.From(ctx).Errorf(err.Error())

			continue
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
	}).V(6).Logf("resolved permissions for user")

	return permissions, nil
}
