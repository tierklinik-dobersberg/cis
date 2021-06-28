package session

import (
	"context"

	"github.com/tierklinik-dobersberg/cis/pkg/models/identity/v1alpha"
)

// UserProvider is used to retrieve the user by name.
type UserProvider interface {
	GetUser(ctx context.Context, name string) (*v1alpha.User, error)
}

// UserProviderFunc is a convenience type for implementing UserProvider.
type UserProviderFunc func(ctx context.Context, name string) (*v1alpha.User, error)

// GetUser implements UserProvider.
func (upf UserProviderFunc) GetUser(ctx context.Context, name string) (*v1alpha.User, error) {
	return upf(ctx, name)
}
