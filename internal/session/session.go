package session

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/jwt"
	"github.com/tierklinik-dobersberg/cis/pkg/models/identity/v1alpha"
)

// SessionKey is used to add a user session to a gin
// request context.
const SessionKey = "http:session"

var contextSessionKey = struct{ key string }{key: SessionKey}

// Session represents an user session.
type Session struct {
	// User is the user of the session.
	User v1alpha.User
	// Roles holds the aggregated list of user roles.
	// Including auto-assigned roles (see autologin package).
	Roles []string
	// AccessUntil may be set to a time until the session has
	// access scope. If no access token is provided it may be
	// nil.
	AccessUntil *time.Time
	// RefreshUntil may be set to the time until a new access
	// token can be issued. That is, the session has a valid
	// token with scope refresh.
	RefreshUntil *time.Time
}

// Set sets the session s on c. It also creates and assigns
// a request copy with a new context to c.
// If s is nil then Set is a no-op.
func Set(c *gin.Context, s *Session) {
	if s == nil {
		return
	}

	c.Request = c.Request.Clone(
		context.WithValue(c.Request.Context(), contextSessionKey, s),
	)

	c.Set(SessionKey, s)
}

// Get returns the session associated with c.
func Get(c *gin.Context) *Session {
	val, ok := c.Get(SessionKey)
	if !ok {
		return nil
	}

	session, _ := val.(*Session)
	return session
}

// FromCtx returns the session associated with ctx.
func FromCtx(ctx context.Context) *Session {
	val := ctx.Value(contextSessionKey)
	if val == nil {
		return nil
	}

	s, _ := val.(*Session)
	return s
}

// UserFromCtx returns the username associated with ctx.
// It returns an empty name in case no session is available.
func UserFromCtx(ctx context.Context) string {
	s := FromCtx(ctx)
	if s == nil {
		return ""
	}

	return s.User.Name
}

// Create creates a new session for user. The caller
// must ensure user is properly authenticated before
// issueing a new access and refresh token to the user.
func Create(app *app.App, user v1alpha.User, w http.ResponseWriter) (*Session, string, error) {
	// Issue a new access token for user.
	accessToken, _, err := GenerateAccessToken(app, user)
	if err != nil {
		return nil, "", fmt.Errorf("generating access token: %w", err)
	}
	accessCookie := CreateCookie(
		app,
		app.Config.AccessTokenCookie,
		accessToken,
		app.BasePath(),
		app.Config.AccessTokenTTL,
	)
	http.SetCookie(w, accessCookie)

	// Issue a new refresh token for user.
	refreshToken, _, err := GenerateRefreshToken(app, user)
	if err != nil {
		return nil, "", fmt.Errorf("generating refresh token: %w", err)
	}
	refreshCookie := CreateCookie(
		app,
		app.Config.RefreshTokenCookie,
		refreshToken,
		app.EndpointPath("api/identity/v1/refresh"),
		app.Config.RefreshTokenTTL,
	)
	http.SetCookie(w, refreshCookie)

	return &Session{
		User:         user,
		Roles:        user.Roles,
		AccessUntil:  &accessCookie.Expires,
		RefreshUntil: &refreshCookie.Expires,
	}, accessToken, nil
}

// Delete the session associated with c.
func Delete(app *app.App, c *gin.Context) error {
	ClearCookie(
		app,
		app.Config.AccessTokenCookie,
		app.BasePath(),
		c,
	)
	ClearCookie(
		app,
		app.Config.RefreshTokenCookie,
		app.EndpointPath("api/identity/v1/refresh"),
		c,
	)

	// TODO(ppacher): maybe switch to "cookies", "storage" in production
	// rather than deleting cache and executionContext as well.
	c.Header("Clear-Site-Data", "*")

	return nil
}

// ClearCookie removes the cookie with the given name.
func ClearCookie(app *app.App, cookieName, path string, c *gin.Context) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:   cookieName,
		Path:   path,
		Domain: app.Config.CookieDomain,
		MaxAge: -1,
	})
}

// CreateCookie wraps value in a http cookie with name.
func CreateCookie(app *app.App, name, value, path string, ttl time.Duration) *http.Cookie {
	return &http.Cookie{
		Name:     name,
		Value:    value,
		Path:     path,
		Domain:   app.Config.CookieDomain,
		HttpOnly: true,
		Secure:   !app.Config.InsecureCookies,
		Expires:  time.Now().Add(ttl),
	}
}

// GenerateRefreshToken generates a new refresh token.
func GenerateRefreshToken(app *app.App, user v1alpha.User) (string, *jwt.Claims, error) {
	return CreateUserToken(
		app,
		user,
		app.Config.RefreshTokenTTL,
		jwt.ScopeRefresh,
	)
}

// GenerateAccessToken generates a new access token.
func GenerateAccessToken(app *app.App, user v1alpha.User) (string, *jwt.Claims, error) {
	return CreateUserToken(
		app,
		user,
		app.Config.AccessTokenTTL,
		jwt.ScopeAccess,
	)
}

// VerifyUserToken verifies a user token and returns the claims
// encoded into the JWT.
func VerifyUserToken(app *app.App, token string) (*jwt.Claims, error) {
	return jwt.ParseAndVerify([]byte(app.Config.Secret), token)
}

// CreateUserToken creates a new signed token for user including scopes
// that's valid for ttl.
func CreateUserToken(app *app.App, user v1alpha.User, ttl time.Duration, scopes ...jwt.Scope) (string, *jwt.Claims, error) {
	var mail string
	if len(user.Mail) > 0 {
		mail = user.Mail[0]
	}

	claims := jwt.Claims{
		Audience:  app.Config.Audience,
		Issuer:    app.Config.Issuer,
		IssuedAt:  time.Now().Unix(),
		ExpiresAt: time.Now().Add(ttl).Unix(),
		NotBefore: time.Now().Unix(),
		AppMetadata: &jwt.AppMetadata{
			Authorization: &jwt.Authorization{
				Roles: user.Roles,
			},
		},
		Email:   mail,
		Scopes:  scopes,
		Subject: user.Name,
		Name:    user.Fullname,
		// TODO(ppacher): ID for revoking?
	}

	token, err := jwt.SignToken(app.Config.SigningMethod, []byte(app.Config.Secret), claims)
	if err != nil {
		return "", nil, err
	}

	return token, &claims, nil
}
