package session

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/cfgspec"
	"github.com/tierklinik-dobersberg/cis/pkg/jwt"
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

func (session *Session) String() string {
	var scopes []string
	if session.AccessUntil != nil {
		scopes = append(scopes, jwt.ScopeAccess)
	}
	if session.RefreshUntil != nil {
		scopes = append(scopes, jwt.ScopeRefresh)
	}

	return fmt.Sprintf("session(%s:%s)", session.User.Name, strings.Join(scopes, ","))
}

// Manager takes care of session management.
type Manager struct {
	cookieFactory *CookieFactory

	identities    UserProvider
	identityConfg *IdentityConfig
	global        *cfgspec.Config
}

// Configure configures the session manager.
func (mng *Manager) Configure(identites UserProvider, identityConfig *IdentityConfig, globalConfig *cfgspec.Config) error {
	mng.identities = identites
	mng.identityConfg = identityConfig
	mng.global = globalConfig

	base := "/"
	if globalConfig.BaseURL != "" {
		u, err := url.Parse(globalConfig.BaseURL)
		if err != nil {
			return fmt.Errorf("invalid base URL: %s", err)
		}

		base = u.Path
	}

	mng.cookieFactory = &CookieFactory{
		InsecureCookies: identityConfig.InsecureCookies,
		Domain:          identityConfig.CookieDomain,
		BasePath:        base,
	}
	return nil
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

// Delete the session associated with c.
func (mng *Manager) Delete(c *gin.Context) error {
	mng.cookieFactory.Clear(
		mng.identityConfg.AccessTokenCookie,
		"",
		c,
	)
	mng.cookieFactory.Clear(
		mng.identityConfg.RefreshTokenCookie,
		"api/identity/v1/refresh",
		c,
	)

	// TODO(ppacher): maybe switch to "cookies", "storage" in production
	// rather than deleting cache and executionContext as well.
	c.Header("Clear-Site-Data", "*")

	return nil
}

// Create creates a new session for user. The caller
// must ensure user is properly authenticated before
// issueing a new access and refresh token to the user.
func (mng *Manager) Create(user v1alpha.User, w http.ResponseWriter) (*Session, string, error) {
	// Issue a new access token for user.
	accessToken, _, err := mng.GenerateAccessToken(user)
	if err != nil {
		return nil, "", fmt.Errorf("generating access token: %w", err)
	}
	accessCookie := mng.cookieFactory.Create(
		mng.identityConfg.AccessTokenCookie,
		accessToken,
		"",
		mng.identityConfg.AccessTokenTTL,
	)
	http.SetCookie(w, accessCookie)

	// Issue a new refresh token for user.
	refreshToken, _, err := mng.GenerateRefreshToken(user)
	if err != nil {
		return nil, "", fmt.Errorf("generating refresh token: %w", err)
	}
	refreshCookie := mng.cookieFactory.Create(
		mng.identityConfg.RefreshTokenCookie,
		refreshToken,
		"api/identity/v1/refresh",
		mng.identityConfg.RefreshTokenTTL,
	)
	http.SetCookie(w, refreshCookie)

	return &Session{
		User:         user,
		Roles:        user.Roles,
		AccessUntil:  &accessCookie.Expires,
		RefreshUntil: &refreshCookie.Expires,
	}, accessToken, nil
}

// GenerateRefreshToken generates a new refresh token.
func (mng *Manager) GenerateRefreshToken(user v1alpha.User) (string, *jwt.Claims, error) {
	return mng.CreateUserToken(
		user,
		mng.identityConfg.RefreshTokenTTL,
		jwt.ScopeRefresh,
	)
}

// GenerateAccessToken generates a new access token.
func (mng *Manager) GenerateAccessToken(user v1alpha.User) (string, *jwt.Claims, error) {
	return mng.CreateUserToken(
		user,
		mng.identityConfg.AccessTokenTTL,
		jwt.ScopeAccess,
	)
}

// VerifyUserToken verifies a user token and returns the claims
// encoded into the JWT.
func (mng *Manager) VerifyUserToken(token string) (*jwt.Claims, error) {
	return jwt.ParseAndVerify([]byte(mng.global.Secret), token)
}

// CreateUserToken creates a new signed token for user including scopes
// that's valid for ttl.
func (mng *Manager) CreateUserToken(user v1alpha.User, ttl time.Duration, scopes ...jwt.Scope) (string, *jwt.Claims, error) {
	var mail string
	if len(user.Mail) > 0 {
		mail = user.Mail[0]
	}

	claims := jwt.Claims{
		Audience:  mng.global.Audience,
		Issuer:    mng.global.Issuer,
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

	token, err := jwt.SignToken(
		mng.global.SigningMethod,
		[]byte(mng.global.Secret),
		claims,
	)
	if err != nil {
		return "", nil, err
	}

	return token, &claims, nil
}
