package identity

import (
	"context"

	"github.com/tierklinik-dobersberg/cis/internal/cfgspec"
	"github.com/tierklinik-dobersberg/cis/pkg/models/identity/v1alpha"
)

type Provider interface {
	// Authenticate tries to authenticate a user. It returns true if the user/
	// password is correct. False otherwise.
	Authenticate(ctx context.Context, name string, password string) bool

	// ListAllUsers returns all users stored in the database.
	ListAllUsers(ctx context.Context) ([]User, error)

	// ListRoles returns a list of all available roles.
	ListRoles(ctx context.Context) ([]Role, error)

	// GetUser returns the user object for the user identified by
	// it's name.
	GetUser(ctx context.Context, name string) (User, error)

	// GetRole returns the role object for the role identified by
	// it's name.
	GetRole(ctx context.Context, name string) (Role, error)

	// GetUserPermissions returns a slice of permissions directly attached to
	// the user identified by name.
	GetUserPermissions(ctx context.Context, name string) ([]cfgspec.Permission, error)

	// GetRolePermissions returns a slice of permissions directly attached to
	// the role identified by name.
	GetRolePermissions(ctx context.Context, name string) ([]cfgspec.Permission, error)
}

type PasswortChangeSupport interface {
	// SetUserPassword updates the password of the given user.
	SetUserPassword(ctx context.Context, user, password, algo string) error
}

type ManageUserSupport interface {
	// CreateUser creates a new user with the given password.
	CreateUser(ctx context.Context, user v1alpha.User, password string) error

	// EditUser updates the record to match u. Changing the username is not allowed.
	EditUser(ctx context.Context, username string, user v1alpha.User) error

	// DisableUser disables the user identified by name.
	DisableUser(ctx context.Context, user string) error

	// AssignUserRole assigns a role to user. It is a no-op if the role is already assigned
	// to user. Both the user and the role must exist.
	AssignUserRole(ctx context.Context, user, role string) error

	// UnassignUserRole removes an assigned role from a user. It is a no-op if the role
	// has not been assigned. Both the user and the role must exist.
	UnassignUserRole(ctx context.Context, user, role string) error

	// CreateRole creates a new role.
	CreateRole(ctx context.Context, role v1alpha.Role) error

	// EditRole should update the role definition of the role identified
	// by oldName.
	EditRole(ctx context.Context, oldName string, role v1alpha.Role) error

	// DeleteRole deletes a role.
	DeleteRole(ctx context.Context, roleName string) error

	// CreatePermission creates a new permission that is either attached to a role or to
	// a user.
	CreatePermission(ctx context.Context, scope string, target string, perm cfgspec.Permission) (string, error)

	// DeletePermission deletes a permission from either a role or a user.
	DeletePermission(ctx context.Context, scope string, owner string, permissionID string) error
}
