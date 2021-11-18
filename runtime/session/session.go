package session

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/pkg/cache"
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
	// AccessUntil may be set to a time until the session has
	// access scope. If no access token is provided it may be
	// nil.
	AccessUntil *time.Time
	// RefreshUntil may be set to the time until a new access
	// token can be issued. That is, the session has a valid
	// token with scope refresh.
	RefreshUntil *time.Time

	// destroyed is closed when the session is destroyed and garbage collected.
	destroyed chan struct{}

	// lock protects all fields an members below it.
	lock sync.Mutex

	// cache is used to store session related data under
	// ephemeral/<session-id>/key
	cache cache.Cache

	// cacheKeyPrefix is the prefix used for cache keys.
	cacheKeyPrefix string

	// extraRoles holds additional roles that are assigned to this
	// session.
	// This also includes auto-assigned roles (see autologin package).
	extraRoles []string

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

// SetEphemeral stores data under key inside the ephemeral data store of the
// session. Note that this only works for "sticky" sessions.
func (session *Session) SetEphemeral(ctx context.Context, key string, data interface{}, ttl time.Duration) error {
	if session.id == "" {
		return fmt.Errorf("session %s is not sticky", session)
	}
	if session.cache == nil {
		return fmt.Errorf("session %s does not have a cache", session)
	}
	dk := fmt.Sprintf("%s%s/%s", session.cacheKeyPrefix, session.id, key)
	blob, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal data: %w", err)
	}

	return session.cache.Write(ctx, dk, blob, cache.WithTTL(ttl))
}

// GetEphemeral retrieves the data stored under key. This only works
// for "sticky" sessions.
func (session *Session) GetEphemeral(ctx context.Context, key string, target interface{}) (time.Time, error) {
	if session.id == "" {
		return time.Time{}, fmt.Errorf("session %s is not sticky", session)
	}
	if session.cache == nil {
		return time.Time{}, fmt.Errorf("session %s does not have a cache", session)
	}

	dk := fmt.Sprintf("%s%s/%s", session.cacheKeyPrefix, session.id, key)
	blob, mt, err := session.cache.Read(ctx, dk)
	if err != nil {
		return time.Time{}, fmt.Errorf("cache.Read: %w", err)
	}

	if err := json.Unmarshal(blob, target); err != nil {
		return time.Time{}, fmt.Errorf("json.Unmarshal: %w", err)
	}

	var eol time.Time
	if mt.NotValidAfter != nil {
		eol = *mt.NotValidAfter
	}
	return eol, nil
}

// IsSticky returns true if the session is sticky.
func (session *Session) IsSticky() bool {
	return session.id != ""
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
	session.lock.Lock()
	defer session.lock.Unlock()

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
	session.lock.Lock()
	defer session.lock.Unlock()

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
	session.lock.Lock()
	defer session.lock.Unlock()
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
