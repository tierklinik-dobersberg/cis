package autologin

import (
	"context"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/database/identitydb"
	"github.com/tierklinik-dobersberg/cis/internal/httpcond"
	"github.com/tierklinik-dobersberg/cis/internal/schema"
	"github.com/tierklinik-dobersberg/logger"
)

// Manager manages and grants automatic user logins.
type Manager struct {
	identiy identitydb.Database

	// conditionBuilder is used to build the conditions a
	// request must fullfill to be granted a session token.
	conditionBuilder *httpcond.Builder

	rw sync.RWMutex
	// users holds all conditions that must be fullfilled for a request
	// to be granted a session token using automatic-login.
	users map[string]httpcond.Condition
}

// NewManager returns a new autologin manager that uses reg
// to build the conditions a HTTP request must fullfill to be
// granted an automatic session token.
func NewManager(ctx context.Context, identity identitydb.Database, reg *httpcond.Registry) *Manager {
	mng := &Manager{
		identiy:          identity,
		conditionBuilder: httpcond.NewBuilder(reg),
	}

	mng.buildConditions(ctx)
	return mng
}

func (mng *Manager) getUserLogin(r *http.Request) (*schema.User, error) {
	mng.rw.RLock()
	defer mng.rw.RUnlock()

	for user, cond := range mng.users {
		matched, err := cond.Match(r)
		if err != nil {
			logger.From(r.Context()).Errorf("failed to check for autologin for user %s: %s", user, err)
			continue
		}

		if matched {
			u, err := mng.identiy.GetUser(r.Context(), user)
			if err != nil {
				return nil, err
			}

			return &u, nil
		}
	}

	return nil, nil
}

// PerformAutologin may add an autologin user session to c.
func (mng *Manager) PerformAutologin(c *gin.Context) {
	// never try to issue an automatic session
	// token if there is a valid user session
	if app.SessionUser(c) == "" {
		autologin, err := mng.getUserLogin(c.Request)
		if err != nil {
			logger.From(c.Request.Context()).Errorf("failed to perform autologin: %s", err.Error())
			return
		}

		if autologin != nil {

			logger.From(c.Request.Context()).Infof("autologin granted for user %s", autologin)
			sessionCookie, err := app.CreateSessionCookie(app.From(c), autologin.User, 5*time.Minute)
			if err != nil {
				logger.From(c.Request.Context()).Errorf("failed to create session token: %s", err)
				return
			}
			http.SetCookie(c.Writer, sessionCookie)

			// make sure all following handlers see a valid
			// session.
			c.Set("session:user", autologin.Name)
			c.Set("session:ttl", 5*time.Minute)
			c.Set("session:roles", autologin.Roles)
		}
	}
}

func (mng *Manager) buildConditions(ctx context.Context) {
	users := mng.identiy.GetAutologinUsers(ctx)

	m := make(map[string]httpcond.Condition, len(users))

	for user, section := range users {
		cond, err := mng.conditionBuilder.Build(section)
		if err != nil {
			logger.From(ctx).Errorf("cannot build autologin conditions for %s: %s", user, err)
			continue
		}

		m[user] = cond
	}

	mng.rw.Lock()
	defer mng.rw.Unlock()

	mng.users = m
}
