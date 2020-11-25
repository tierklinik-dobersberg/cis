package permission

import (
	"context"

	"github.com/tierklinik-dobersberg/userhub/internal/identitydb"
	"github.com/tierklinik-dobersberg/userhub/pkg/models/v1alpha"
)

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

	// start with user permissions
	directUserPermissions, errr := res.db.GetUserPermissions(ctx, user)
	if err != nil {
		return nil, err
	}
	permissions = append(permissions, directUserPermissions)

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

		groupPermissions = append(groupPermissions, grpPerms...)
	}

	if len(groupPermissions) > 0 {
		permissions = append(permissions, groupPermissions)
	}

	return permissions, nil
}
