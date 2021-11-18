package session

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gofrs/uuid"
	"github.com/tierklinik-dobersberg/cis/pkg/cache"
	"github.com/tierklinik-dobersberg/cis/pkg/jwt"
	"github.com/tierklinik-dobersberg/cis/pkg/models/identity/v1alpha"
)

// Manager takes care of session management.
type Manager struct {
	UserProvider

	cookieFactory *CookieFactory

	identityConfg   *IdentityConfig
	secret          string
	sessionIDCookie string
	cache           cache.Cache
	cachePrefix     string

	sessionLock   sync.RWMutex
	activeSession map[string]*Session
}

// Configure configures the session manager.
func (mng *Manager) Configure(identites UserProvider, identityConfig *IdentityConfig, secret, baseURL string, cache cache.Cache, cachePrefix string) error {
	mng.UserProvider = identites
	mng.identityConfg = identityConfig
	mng.activeSession = make(map[string]*Session)
	mng.sessionIDCookie = identityConfig.SessionIDCookie
	mng.secret = secret
	mng.cache = cache
	mng.cachePrefix = cachePrefix

	// start cleaning orphand sessions
	go func() {
		for range time.Tick(time.Minute) {
			mng.clearOrphandSessions()
		}
	}()

	base := "/"
	if baseURL != "" {
		u, err := url.Parse(baseURL)
		if err != nil {
			return fmt.Errorf("invalid base URL: %w", err)
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

// CreateByName is like Create but uses the UserProvider to lookup the session
// user by it's name.
func (mng *Manager) CreateByName(ctx context.Context, name string, w http.ResponseWriter) (*Session, string, error) {
	user, err := mng.GetUser(ctx, name)
	if err != nil {
		return nil, "", fmt.Errorf("user %s: %w", name, err)
	}
	return mng.Create(*user, w)
}

// Create creates a new session for user. The caller
// must ensure user is properly authenticated before
// issuing a new access and refresh token to the user.
// Create will also create a new unique identifier for the
// session and set that as the cis-sid cookie.
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

	sess := &Session{
		User:         user,
		AccessUntil:  &accessCookie.Expires,
		RefreshUntil: &refreshCookie.Expires,
		lastAccess:   time.Now(),
		destroyed:    make(chan struct{}),
	}

	if err := mng.saveSession(sess, w); err != nil {
		return nil, "", fmt.Errorf("save: %w", err)
	}

	return sess, accessToken, nil
}

func (mng *Manager) saveSession(sess *Session, w http.ResponseWriter) error {
	// This is a NOOP if SessionIDCookie= is empty.
	if mng.sessionIDCookie == "" {
		return nil
	}

	// create a new sid for the session.
	sid, err := uuid.NewV4()
	if err != nil {
		return fmt.Errorf("failed to generate session id")
	}
	sess.id = sid.String()
	sess.cache = mng.cache
	sess.cacheKeyPrefix = mng.cachePrefix

	// inform the browser about the session ID. this is best-effort only
	// as the Set-Cookie header might just be ignored.
	http.SetCookie(w, mng.cookieFactory.Create(
		mng.sessionIDCookie,
		sess.id,
		"/",
		0,
	))

	// store the session within activeSessions under sid.
	mng.sessionLock.Lock()
	defer mng.sessionLock.Unlock()
	mng.activeSession[sid.String()] = sess
	return nil
}

func (mng *Manager) clearOrphandSessions() {
	l := log.From(context.TODO()).V(4)

	l.Logf("cleaning orphand sessions")
	mng.sessionLock.Lock()
	defer mng.sessionLock.Unlock()

	for key, sess := range mng.activeSession {
		// delete sessions that are unused for more than a week
		if inactivity := time.Since(sess.LastAccess()); inactivity > time.Hour*24*7 {
			l.Logf("deleting session for user %s after %s of inactivity", sess.User.Name, inactivity)
			delete(mng.activeSession, key)

			func() {
				defer func() {
					if x := recover(); x != nil {
						l.Logf("recovered from panic when closing session.destroyed channel")
					}
				}()
				close(sess.destroyed)
			}()
		}
	}
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
	return jwt.ParseAndVerify([]byte(mng.secret), token)
}

// CreateUserToken creates a new signed token for user including scopes
// that's valid for ttl.
func (mng *Manager) CreateUserToken(user v1alpha.User, ttl time.Duration, scopes ...jwt.Scope) (string, *jwt.Claims, error) {
	var mail string
	if len(user.Mail) > 0 {
		mail = user.Mail[0]
	}

	claims := jwt.Claims{
		Audience:  mng.identityConfg.Audience,
		Issuer:    mng.identityConfg.Issuer,
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
		mng.identityConfg.SigningMethod,
		[]byte(mng.secret),
		claims,
	)
	if err != nil {
		return "", nil, err
	}

	return token, &claims, nil
}
