package autologin

import (
	"context"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/pkg/models/identity/v1alpha"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
	"github.com/tierklinik-dobersberg/cis/runtime/httpcond"
	"github.com/tierklinik-dobersberg/cis/runtime/session"
)

var log = pkglog.New("autologin")

type autologinRecord struct {
	httpcond.Condition
	createSession bool
}

// Manager manages and grants automatic user logins.
type Manager struct {
	session *session.Manager

	// conditionBuilder is used to build the conditions a
	// request must fulfill to be granted a session token.
	conditionBuilder *httpcond.Builder

	rw sync.RWMutex
	// users holds all conditions that must be fulfilled for a request
	// to be granted a session token using automatic-login.
	users map[string]autologinRecord

	// roleAssignment holds all conditions that must be fulfilled for a
	// request to be granted an additional role.
	roleAssignment map[string]httpcond.Condition
}

// NewManager returns a new autologin manager that uses reg
// to build the conditions a HTTP request must fulfill to be
// granted an automatic session token.
func NewManager(ctx context.Context, sessionManager *session.Manager, reg *httpcond.Registry, users map[string]conf.Section, roles map[string]conf.Section) *Manager {
	mng := &Manager{
		conditionBuilder: httpcond.NewBuilder(reg),
		session:          sessionManager,
	}

	mng.buildConditions(ctx, users, roles)
	return mng
}

func (mng *Manager) getUserLogin(r *http.Request) (*v1alpha.User, bool, error) {
	mng.rw.RLock()
	defer mng.rw.RUnlock()

	for user, cond := range mng.users {
		matched, err := cond.Match(r)
		if err != nil {
			log.From(r.Context()).Errorf("failed to check for autologin for user %s: %s", user, err)
			continue
		}

		if matched {
			u, err := mng.session.GetUser(r.Context(), user)
			if err != nil {
				return nil, false, err
			}

			return u, cond.createSession, nil
		}
	}

	return nil, false, nil
}

// GetAutoAssignedRoles returns all roles that should be automatically assigned
// to r.
func (mng *Manager) GetAutoAssignedRoles(r *http.Request) ([]string, error) {
	mng.rw.RLock()
	defer mng.rw.RUnlock()

	var roles []string

	for role, cond := range mng.roleAssignment {
		matched, err := cond.Match(r)
		if err != nil {
			log.From(r.Context()).Errorf("failed to check for autoassignment of role %s: %s", role, err)
			continue
		}

		if matched {
			roles = append(roles, role)
		}
	}

	return roles, nil
}

// PerformAutologin may add an autologin user session to c.
func (mng *Manager) PerformAutologin(c echo.Context) {
	log := log.From(c.Request().Context())
	// never try to issue an automatic session
	// token if there is a valid user session
	if session.Get(c) == nil {
		autologin, createSession, err := mng.getUserLogin(c.Request())
		if err != nil {
			log.Errorf("failed to perform autologin: %s", err.Error())
			return
		}

		if autologin != nil {
			var sess *session.Session
			if !createSession {
				// DO NOT use session.Create() here as this would
				// issue a real access token and REFRESH token to
				// the client.
				until := time.Now().Add(5 * time.Second)
				sess = &session.Session{
					User:        *autologin,
					AccessUntil: &until,
				}
			} else {
				// the user explicitly set CreateSession=yes in the autologin section
				// of this user.
				sess, _, err = mng.session.Create(*autologin, c.Response())
				if err != nil {
					log.Errorf("failed to create autologin session: %s", err.Error())
				}
			}

			session.Set(c, sess)
		}
	}

	// we only do role auto-assignment if there's a valid
	// user session.
	sess := session.Get(c)
	if sess == nil {
		return
	}

	roles, err := mng.GetAutoAssignedRoles(c.Request())
	if err != nil {
		log.Errorf("failed to get auto-assign roles: %s", err)
		return
	}
	if len(roles) == 0 {
		return
	}

	log.V(5).Logf("automatically assigning roles %s", strings.Join(roles, ", "))
	for _, role := range roles {
		sess.AddRole(role)
	}
}

func (mng *Manager) buildConditions(ctx context.Context, users map[string]conf.Section, roles map[string]conf.Section) {
	userConditionMap := make(map[string]autologinRecord, len(users))
	for user, section := range users {
		cond, err := mng.conditionBuilder.Build(section)
		if err != nil {
			log.From(ctx).Errorf("cannot build autologin conditions for user %s: %s", user, err)
			continue
		}

		userConditionMap[user] = autologinRecord{
			Condition:     cond,
			createSession: section.GetBoolDefault("CreateSession", false),
		}
	}

	roleConditionMap := make(map[string]httpcond.Condition, len(roles))
	for role, section := range roles {
		cond, err := mng.conditionBuilder.Build(section)
		if err != nil {
			log.From(ctx).Errorf("cannot build autoassign conditions for role %s: %s", role, err)
			continue
		}

		roleConditionMap[role] = cond
	}

	mng.rw.Lock()
	defer mng.rw.Unlock()

	mng.users = userConditionMap
	mng.roleAssignment = roleConditionMap
}
