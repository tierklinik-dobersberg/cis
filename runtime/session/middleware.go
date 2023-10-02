package session

import (
	"context"

	"github.com/labstack/echo/v4"
	idmv1 "github.com/tierklinik-dobersberg/apis/gen/go/tkd/idm/v1"
)

var userContextKey = struct{ s string }{"user-context-key"}

// UserFromCtx returns the username associated with ctx.
// It returns an empty name in case no session is available.
func UserFromCtx(ctx context.Context) *idmv1.Profile {
	value, _ := ctx.Value(userContextKey).(*idmv1.Profile)
	return value
}

// UserProvider is used to retrieve the user by name.
type UserProvider interface {
	GetUser(ctx context.Context, userId string) (*idmv1.Profile, error)
}

// UserProviderFunc is a convenience type for implementing UserProvider.
type UserProviderFunc func(ctx context.Context, id string) (*idmv1.Profile, error)

// GetUser implements UserProvider.
func (upf UserProviderFunc) GetUser(ctx context.Context, id string) (*idmv1.Profile, error) {
	return upf(ctx, id)
}

// Middleware is a echo MiddlewareFunc that extracts session data from incoming
// HTTP requests and handles automatic issuing of new access tokens for
// provided refresh tokens.
// trunk-ignore(golangci-lint/gocognit)
func Middleware(provider UserProvider) func(next echo.HandlerFunc) echo.HandlerFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			userNameHeader := c.Request().Header.Get("X-Remote-User-ID")

			if userNameHeader != "" {
				ctx := c.Request().Context()
				user, err := provider.GetUser(ctx, userNameHeader)
				if err != nil {
					return err
				}

				ctx = context.WithValue(c.Request().Context(), userContextKey, user)

				req := c.Request().WithContext(ctx)
				c.SetRequest(req)
			}

			return next(c)
		}
	}
}

// Require aborts an incoming http request if it does not have
// a valid session token.
func Require() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// FIXME(ppacher)
			return next(c)
		}
	}
}
