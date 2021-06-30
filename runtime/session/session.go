package session

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gofrs/uuid"
	"github.com/tierklinik-dobersberg/cis/pkg/jwt"
	"github.com/tierklinik-dobersberg/cis/pkg/models/identity/v1alpha"
)

// SessionKey is used to add a user session to a gin
// request context.
const SessionKey = "http:session"

var contextSessionKey = struct{ key string }{key: SessionKey}

// Session represents an user session.
type Session struct {
	// id holds the ID of the session.
	// IMPORTANT: the session ID (cis-sid cookie by default) does NOT
	// PROVIDE ANY ADDITIONAL SECURITY. It's only meant to provide
	// and support internal grouping of browser sessions. Do not
	// rely on this value for anything that's important or must work
	// outside of the browser!
	id string

	// User is the user of the session.
	User v1alpha.User
	// ExtraRoles holds additional roles that are assigned to this
	// session.
	// Including auto-assigned roles (see autologin package).
	ExtraRoles []string
	// AccessUntil may be set to a time until the session has
	// access scope. If no access token is provided it may be
	// nil.
	AccessUntil *time.Time
	// RefreshUntil may be set to the time until a new access
	// token can be issued. That is, the session has a valid
	// token with scope refresh.
	RefreshUntil *time.Time

	// lock protects all fields an members below it.
	lock sync.Mutex

	// lastAccess holds the last time the session has accessed
	// the api.
	lastAccess time.Time
}

// MarkActive marks the session as still being active.
func (session *Session) MarkActive() {
	session.lock.Lock()
	defer session.lock.Unlock()
	session.lastAccess = time.Now()
}

// LastAccess returns the time the session has talked to the
// API the last time.
func (session *Session) LastAccess() time.Time {
	session.lock.Lock()
	defer session.lock.Unlock()
	return session.lastAccess
}

func (session *Session) String() string {
	var scopes []string
	if session.AccessUntil != nil {
		scopes = append(scopes, jwt.ScopeAccess)
	}
	if session.RefreshUntil != nil {
		scopes = append(scopes, jwt.ScopeRefresh)
	}

	sid := session.id
	if sid == "" {
		sid = "[api]"
	}

	return fmt.Sprintf("session(%s: %s:%s)", sid, session.User.Name, strings.Join(scopes, ","))
}

// DistinctRoles returns an aggregates list of roles
// that apply to this session.
func (session *Session) DistinctRoles() []string {
	var lm = make(map[string]struct{})
	for _, r := range session.User.Roles {
		lm[r] = struct{}{}
	}
	for _, r := range session.ExtraRoles {
		lm[r] = struct{}{}
	}
	var distinctRoles []string
	for key := range lm {
		distinctRoles = append(distinctRoles, key)
	}
	return distinctRoles
}

// Manager takes care of session management.
type Manager struct {
	cookieFactory *CookieFactory

	identities      UserProvider
	identityConfg   *IdentityConfig
	secret          string
	sessionIdCookie string

	sessionLock   sync.RWMutex
	activeSession map[string]*Session
}

// Configure configures the session manager.
func (mng *Manager) Configure(identites UserProvider, identityConfig *IdentityConfig, secret, baseURL string) error {
	mng.identities = identites
	mng.identityConfg = identityConfig
	mng.activeSession = make(map[string]*Session)
	mng.sessionIdCookie = identityConfig.SessionIDCookie
	mng.secret = secret

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
	}

	if err := mng.saveSession(sess, w); err != nil {
		return nil, "", fmt.Errorf("save: %s", err)
	}

	return sess, accessToken, nil
}

func (mng *Manager) saveSession(sess *Session, w http.ResponseWriter) error {
	// This is a NOOP if SessionIDCookie= is empty.
	if mng.sessionIdCookie == "" {
		return nil
	}

	// create a new sid for the session.
	sid, err := uuid.NewV4()
	if err != nil {
		return fmt.Errorf("failed to generate session id")
	}
	sess.id = sid.String()

	// inform the browser about the session ID. this is best-effort only
	// as the Set-Cookie header might just be ignored.
	http.SetCookie(w, mng.cookieFactory.Create(
		mng.sessionIdCookie,
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
