package session

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/pkg/cache"
	"github.com/tierklinik-dobersberg/cis/pkg/jwt"
	"github.com/tierklinik-dobersberg/cis/pkg/models/identity/v1alpha"
)

// SessionKey is used to add a user session to a gin
// request context.
const SessionKey = "http:session"

var contextSessionKey = struct{ key string }{key: SessionKey}

type stickySession struct {
	// lock protects all fields an members below it.
	sync.Mutex

	// destroyed is closed when the session is destroyed and garbage collected.
	destroyed chan struct{}

	// cache is used to store session related data under
	// ephemeral/<session-id>/key
	cache cache.Cache

	// cacheKeyPrefix is the prefix used for cache keys.
	cacheKeyPrefix string

	// lastAccess holds the last time the session has accessed
	// the api.
	lastAccess time.Time
}

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
	// AccessUntil may be set to a time until the session has
	// access scope. If no access token is provided it may be
	// nil.
	AccessUntil *time.Time
	// RefreshUntil may be set to the time until a new access
	// token can be issued. That is, the session has a valid
	// token with scope refresh.
	RefreshUntil *time.Time

	// sticky is a reference to the sticky session data
	sticky *stickySession

	// roleLock protects all fields an members below it.
	roleLock sync.Mutex

	// extraRoles holds additional roles that are assigned to this
	// session.
	// This also includes auto-assigned roles (see autologin package).
	extraRoles []string
}

// MarkActive marks the session as still being active.
func (session *Session) MarkActive() {
	if session.sticky == nil {
		return
	}

	session.sticky.Lock()
	defer session.sticky.Unlock()
	session.sticky.lastAccess = time.Now()
}

// LastAccess returns the time the session has talked to the
// API the last time. If the session is not sticky the zero
// time is returned.
func (session *Session) LastAccess() time.Time {
	if session.sticky == nil {
		return time.Time{}
	}

	session.sticky.Lock()
	defer session.sticky.Unlock()

	return session.sticky.lastAccess
}

// SetEphemeral stores data under key inside the ephemeral data store of the
// session. Note that this only works for "sticky" sessions.
func (session *Session) SetEphemeral(ctx context.Context, key string, data interface{}, ttl time.Duration) error {
	if session.sticky == nil || session.id == "" {
		return fmt.Errorf("session %s is not sticky", session)
	}
	if session.sticky.cache == nil {
		return fmt.Errorf("session %s does not have a cache", session)
	}
	dk := fmt.Sprintf("%s%s/%s", session.sticky.cacheKeyPrefix, session.id, key)
	blob, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal data: %w", err)
	}

	return session.sticky.cache.Write(ctx, dk, blob, cache.WithTTL(ttl))
}

// GetEphemeral retrieves the data stored under key. This only works
// for "sticky" sessions.
func (session *Session) GetEphemeral(ctx context.Context, key string, target interface{}) (time.Time, error) {
	if session.sticky == nil || session.id == "" {
		return time.Time{}, fmt.Errorf("session %s is not sticky", session)
	}
	if session.sticky.cache == nil {
		return time.Time{}, fmt.Errorf("session %s does not have a cache", session)
	}

	dk := fmt.Sprintf("%s%s/%s", session.sticky.cacheKeyPrefix, session.id, key)
	blob, meta, err := session.sticky.cache.Read(ctx, dk)
	if err != nil {
		return time.Time{}, fmt.Errorf("cache.Read: %w", err)
	}

	if err := json.Unmarshal(blob, target); err != nil {
		return time.Time{}, fmt.Errorf("json.Unmarshal: %w", err)
	}

	var eol time.Time
	if meta.NotValidAfter != nil {
		eol = *meta.NotValidAfter
	}

	return eol, nil
}

// IsSticky returns true if the session is sticky.
func (session *Session) IsSticky() bool {
	return session.id != "" && session.sticky != nil
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
	session.roleLock.Lock()
	defer session.roleLock.Unlock()

	var lm = make(map[string]struct{})
	for _, r := range session.User.Roles {
		lm[r] = struct{}{}
	}
	for _, r := range session.extraRoles {
		lm[r] = struct{}{}
	}
	distinctRoles := make([]string, 0, len(lm))
	for key := range lm {
		distinctRoles = append(distinctRoles, key)
	}

	return distinctRoles
}

// ExtraRoles holds additional roles that are assigned to this
// session.
// This also includes auto-assigned roles (see autologin package).
func (session *Session) ExtraRoles() []string {
	session.roleLock.Lock()
	defer session.roleLock.Unlock()

	sl := make([]string, len(session.extraRoles))
	copy(sl, session.extraRoles)

	return sl
}

// HasRole returns true if session has role either assigned
// to the session user or as a part of the sessions extra
// roles (like assigned by the autologin package).
func (session *Session) HasRole(role string) bool {
	added := session.addRole(role, true)

	return !added
}

// AddRole adds role to the sessions extra roles if it's not
// already part of the user or session role set.
func (session *Session) AddRole(role string) bool {
	return session.addRole(role, false)
}

func (session *Session) addRole(role string, dryRun bool) bool {
	for _, r := range session.User.Roles {
		if r == role {
			return false
		}
	}

	session.roleLock.Lock()
	defer session.roleLock.Unlock()
	for _, r := range session.extraRoles {
		if r == role {
			return false
		}
	}
	if !dryRun {
		session.extraRoles = append(session.extraRoles, role)
	}

	return true
}

// Set sets the session s on c. It also creates and assigns
// a request copy with a new context to c.
// If s is nil then Set is a no-op.
func Set(c echo.Context, session *Session) {
	if session == nil {
		return
	}

	req := c.Request().Clone(
		context.WithValue(c.Request().Context(), contextSessionKey, session),
	)

	c.SetRequest(req)

	c.Set(SessionKey, session)
}

// Get returns the session associated with c.
func Get(c echo.Context) *Session {
	val, _ := c.Get(SessionKey).(*Session)

	return val
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
