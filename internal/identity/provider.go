package identity

import (
	"context"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/cfgspec"
)

type Provider interface {
	// Authenticate tries to authenticate a user. It returns true if the user/
	// password is correct. False otherwise.
	Authenticate(ctx context.Context, name string, password string) bool

	// SetUserPassword updates the password of the given user.
	SetUserPassword(ctx context.Context, user, password, algo string) error

	// ListAllUsers returns all users stored in the database.
	ListAllUsers(ctx context.Context) ([]cfgspec.User, error)

	// GetUser returns the user object for the user identified by
	// it's name.
	GetUser(ctx context.Context, name string) (cfgspec.User, error)

	// GetRole returns the role object for the role identified by
	// it's name.
	GetRole(ctx context.Context, name string) (cfgspec.Role, error)

	// GetUserPermissions returns a slice of permissions directly attached to
	// the user identified by name.
	GetUserPermissions(ctx context.Context, name string) ([]cfgspec.Permission, error)

	// GetRolePermissions returns a slice of permissions directly attached to
	// the role identified by name.
	GetRolePermissions(ctx context.Context, name string) ([]cfgspec.Permission, error)

	// GetAutologinUsers returns a map that contains the autologin section for each
	// user that has one defined.
	GetAutologinUsers(ctx context.Context) map[string]conf.Section

	// GetAutologinRoles returns a map that contains the autologin section for
	// each role that has one defined.
	GetAutologinRoles(ctx context.Context) map[string]conf.Section
}
