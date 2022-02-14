package autologin

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
	"github.com/tierklinik-dobersberg/cis/runtime/httpcond"
	"github.com/tierklinik-dobersberg/cis/runtime/session"
	"github.com/tierklinik-dobersberg/logger"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

var log = pkglog.New("autologin")

type autologinRecord struct {
	httpcond.Condition `option:"-"`

	CreateSession bool
	User          string
	Roles         []string
	Name          string
}

// Manager manages and grants automatic user logins.
type Manager struct {
	session *session.Manager

	// conditionBuilder is used to build the conditions a
	// request must fulfill to be granted a session token.
	conditionBuilder *httpcond.Builder

	rw sync.RWMutex

	conditions []*autologinRecord
}

// NewManager returns a new autologin manager that uses reg
// to build the conditions a HTTP request must fulfill to be
// granted an automatic session token.
func NewManager(ctx context.Context, sessionManager *session.Manager, reg *httpcond.Registry, sections []conf.Section) *Manager {
	if reg == nil {
		reg = httpcond.DefaultRegistry
	}
	mng := &Manager{
		conditionBuilder: httpcond.NewBuilder(reg),
		session:          sessionManager,
	}

	mng.buildConditions(ctx, sections)
	return mng
}

func (mng *Manager) findMatchingRecords(c echo.Context) []*autologinRecord {
	var result []*autologinRecord
	log := log.From(c.Request().Context())

	mng.rw.RLock()
	defer mng.rw.RUnlock()
	for _, rec := range mng.conditions {
		matched, err := rec.Match(c)
		log.WithFields(logger.Fields{
			"policy":  rec.Name,
			"matched": matched,
			"error":   fmt.Sprintf("%s", err),
		}).V(7).Logf("evaluated condition %s", rec.Name)

		if err != nil {
			log.Errorf("failed to evaluate http request condition: %s", err)
			continue
		}
		if matched {
			result = append(result, rec)
		}
	}
	return result
}

// PerformAutologin may add an autologin user session to c.
func (mng *Manager) PerformAutologin(c echo.Context) {
	ctx := c.Request().Context()
	log := log.From(c.Request().Context())

	ctx, sp := otel.Tracer("").Start(ctx, "PerformAutologin")
	defer sp.End()

	matchedConditions := mng.findMatchingRecords(c)

	sp.SetAttributes(attribute.Int("autologin.matched_conditions.count", len(matchedConditions)))

	if len(matchedConditions) == 0 {
		return
	}

	log.Infof("[autologin] found %d matching conditions", len(matchedConditions))
	var (
		user          string
		createSession bool
		roles         = make(map[string]struct{})
		roleNames     = []string{}
	)
	for _, rec := range matchedConditions {
		if rec.User != "" {
			if user != "" {
				log.Errorf("multiple matches on request for users %s and %s", user, rec.User)
			} else {
				user = rec.User
				createSession = rec.CreateSession
			}
		}

		for _, r := range rec.Roles {
			if _, ok := roles[r]; !ok {
				roles[r] = struct{}{}
				roleNames = append(roleNames, r)
			}
		}
	}

	// never try to issue an automatic session
	// token if there is a valid user session
	if session.Get(c) == nil && user != "" {
		if autologin, err := mng.session.GetUser(ctx, user); err != nil {
			log.Errorf("failed to get user with name %s from provider: %s", user, err)
			sp.RecordError(err)
			sp.SetStatus(codes.Error, err.Error())
		} else {
			sp.SetAttributes(
				attribute.Bool("autologin.create_session", createSession),
				attribute.String("autologin.user", user),
			)

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
					sp.RecordError(err)
					sp.SetStatus(codes.Error, err.Error())
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

	if len(roleNames) == 0 {
		return
	}

	log.V(5).Logf("automatically assigning roles %v", roleNames)
	for _, role := range roleNames {
		sess.AddRole(role)
	}
}

func (mng *Manager) buildConditions(ctx context.Context, sections []conf.Section) error {
	var records []*autologinRecord

	spec := Spec(mng.conditionBuilder.Registry())

	for _, sec := range sections {
		cond, err := mng.conditionBuilder.Build(sec)
		if err != nil {
			return fmt.Errorf("failed to build condition: %w", err)
		}

		record := autologinRecord{
			Condition: cond,
		}

		if err := conf.DecodeSections([]conf.Section{sec}, spec, &record); err != nil {
			return fmt.Errorf("failed to decode configuration: %w", err)
		}

		records = append(records, &record)
	}

	log.From(ctx).Infof("processed %d sections successfully", len(records))

	mng.conditions = records

	return nil
}
