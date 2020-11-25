package permission

import (
	"context"

	"github.com/tierklinik-dobersberg/logger"
	"github.com/tierklinik-dobersberg/userhub/internal/identitydb"
	"github.com/tierklinik-dobersberg/userhub/pkg/models/v1alpha"
)

// Resolver is used for resolving user and group
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
func (res *Resolver) ResolveUserPermissions(ctx context.Context, user string) ([][]v1alpha.Permission, error) {
	var permissions [][]v1alpha.Permission
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

	// collect permissions of direct groups
	var groupPermissions []v1alpha.Permission
	for _, groupName := range userObj.GroupNames {
		grpPerms, err := res.db.GetGroupPermissions(ctx, groupName)
		if err != nil {
			return nil, err
		}

		countIndirect += len(grpPerms)
		groupPermissions = append(groupPermissions, grpPerms...)
	}

	if len(groupPermissions) > 0 {
		permissions = append(permissions, groupPermissions)
	}

	logger.From(ctx).WithFields(logger.Fields{
		"total":     countIndirect + countDirect,
		"direct":    countDirect,
		"inherited": countIndirect,
		"user":      user,
	}).Infof("resolved permissions for user")

	return permissions, nil
}
