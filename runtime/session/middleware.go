package session

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/pkg/jwt"
	"github.com/tierklinik-dobersberg/cis/pkg/models/identity/v1alpha"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
	"github.com/tierklinik-dobersberg/logger"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

var log = pkglog.New("session")

// Middleware is a echo MiddlewareFunc that extracts session data from incoming
// HTTP requests and handles automatic issuing of new access tokens for
// provided refresh tokens.
// trunk-ignore(golangci-lint/gocognit)
func (mng *Manager) Middleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		log := log.From(c.Request().Context())

		// if someone else already added a session we'll skip
		// everything here.
		session := Get(c)
		if session != nil {
			log.Infof("request is already assigned to %s", session)

			return next(c)
		}

		ctx, span := otel.Tracer("").Start(c.Request().Context(), "session.Middleware")
		defer span.End()

		//
		// get access and refresh tokens
		// we only log errors here since the user of the token might
		// have been deleted and returning and error here will block
		// the user from authenticating using a different user.
		//
		accessToken, accessUser, err := mng.getAccessToken(ctx, c)
		if err != nil {
			log.V(3).Logf("failed to get access token: %s", err)
		}
		refreshToken, refreshUser, err := mng.getRefreshToken(ctx, c)
		if err != nil {
			log.V(3).Logf("failed to get refresh token: %s", err)
		}

		// if there's neither a refresh nor an access token we'll
		// skip it.
		if refreshToken == nil && accessToken == nil {
			log.V(3).Log("unauthenticated request: no access or refresh token provided")

			return next(c)
		}

		// If we have access and refresh tokens they MUST belong to the same user!
		if accessUser != nil && refreshUser != nil && accessUser.Name != refreshUser.Name {
			// TODO(ppacher): INCIDENT!
			log.V(3).Logf("security alert: access and refresh token user differ: %s != %s", accessUser.Name, refreshUser.Name)

			return httperr.BadRequest(
				fmt.Errorf("access and refresh token do not belong to the same user"),
			)
		}

		user := accessUser
		if user == nil {
			user = refreshUser
		}
		if user == nil {
			log.V(3).Log("request denied: failed to find user for token")
			span.RecordError(fmt.Errorf("failed to find user for access/refresh token"))

			return next(c)
		}

		if user.Disabled != nil && *user.Disabled {
			log.V(3).Log("request denied: user has been disabled!")

			return httperr.Forbidden(
				fmt.Errorf("user has been disabled"),
			)
		}

		// at this point we have a valid session
		// (either access scope, refresh scope or both)

		// we can now check if there's an active session ID
		// and reuse that. otherwise, we just create a new session
		// object and continue with that.
		var (
			sticky    *stickySession
			sessionID string
		)
		if mng.sessionIDCookie != "" {
			sid, err := c.Cookie(mng.sessionIDCookie)
			if err != nil && !errors.Is(err, http.ErrNoCookie) {
				return httperr.InternalError().SetInternal(err)
			}
			if err == nil {
				sessionID = sid.Value
				sticky = mng.getSessionByID(sid.Value)
			}
		}

		// there's no existing session (that did a /login)
		// so just create a new one and use that
		session = &Session{
			id:     sessionID,
			User:   *user,
			sticky: sticky,
		}

		// expires-at must still be in the future, otherwise
		// the tokens would not have been valid and we wouldn't
		// get here anyway.
		if accessToken != nil {
			t := time.Unix(accessToken.ExpiresAt, 0)
			session.AccessUntil = &t
		}
		if refreshToken != nil {
			t := time.Unix(refreshToken.ExpiresAt, 0)
			session.RefreshUntil = &t
		}

		// if we don't have a valid access or refresh scope now
		// return without setting a session on c.
		if session.AccessUntil == nil && session.RefreshUntil == nil {
			log.V(3).Logf("unauthenticated request: no valid access or refresh token found: %s", session)

			return next(c)
		}

		// this is a new session without a sid. Let's create one and
		// save it as active.
		if session.sticky == nil {
			if err := mng.saveSession(session, c.Response()); err != nil {
				log.V(3).Logf("failed to save session: %s", err)
			}
		}

		trace.SpanFromContext(c.Request().Context()).SetAttributes(
			attribute.String("session.user", session.User.Name),
			attribute.String("session.id", session.id),
			attribute.StringSlice("session.extra_roles", session.extraRoles),
		)

		// we do have an existing session here so let's update the request
		// and make sure it has the sid set as a logging field
		req := c.Request().Clone(
			logger.WithFields(c.Request().Context(), logger.Fields{
				"httpSessionId": session.id,
			}),
		)
		c.SetRequest(req)

		log.V(6).Logf("session %s valid", session)

		// mark the session as active.
		session.MarkActive()

		// add the session to the gin context.
		Set(c, session)

		return next(c)
	}
}

func (mng *Manager) getSessionByID(id string) *stickySession {
	mng.sessionLock.Lock()
	defer mng.sessionLock.Unlock()

	return mng.activeSession[id]
}

// IssueAccessToken creates a new access token for the active session.
// The session must have a valid refresh token set.
func (mng *Manager) IssueAccessToken(c echo.Context) (string, error) {
	sess := Get(c)
	if sess == nil {
		return "", echo.NewHTTPError(http.StatusUnauthorized, "no session found")
	}

	if sess.RefreshUntil == nil {
		return "", echo.NewHTTPError(http.StatusUnauthorized, "no refresh token provided")
	}

	if sess.RefreshUntil.Before(time.Now()) {
		return "", echo.NewHTTPError(http.StatusUnauthorized, "refresh token expired "+time.Since(*sess.RefreshUntil).String()+" ago")
	}

	// mark the current session as active since we just created
	// a new access token for it.
	sess.MarkActive()

	token, _, err := mng.GenerateAccessToken(sess.User)
	if err != nil {
		return "", httperr.InternalError().SetInternal(err)
	}

	c.SetCookie(
		mng.cookieFactory.Create(
			mng.identityConfg.AccessTokenCookie,
			token,
			"",
			mng.identityConfg.AccessTokenTTL,
		),
	)

	return token, nil
}

// Require aborts an incoming http request if it does not have
// a valid session token.
func Require() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			sess := Get(c)
			if sess == nil || sess.AccessUntil == nil {
				if sess == nil {
					log.From(c.Request().Context()).Infof("Request without a valid session, aborting: %s", c.Path())
				} else {
					log.From(c.Request().Context()).Infof("Request session without access scope, aborting")
				}

				return httperr.Unauthorized("no access token provided")
			}

			return next(c)
		}
	}
}

func cookieValueOrBearer(cookieName string, r *http.Request) string {
	cookie, err := r.Cookie(cookieName)
	if err == nil {
		return cookie.Value
	}

	if h := r.Header.Get("Authorization"); strings.HasPrefix(h, "Bearer ") {
		return strings.TrimPrefix(h, "Bearer ")
	}

	return ""
}

func (mng *Manager) getAccessToken(ctx context.Context, c echo.Context) (*jwt.Claims, *v1alpha.User, error) {
	tokenValue := cookieValueOrBearer(mng.identityConfg.AccessTokenCookie, c.Request())
	if tokenValue == "" {
		return nil, nil, nil
	}

	claims, err := mng.VerifyUserToken(tokenValue)
	if err != nil {
		return nil, nil, err
	}

	// skip tokens that don't have our app metadata tag or that use
	// an old token version.
	// This can be useful to immediately revoke an active token
	// by increasing the token version
	if claims.AppMetadata == nil || claims.AppMetadata.TokenVersion != CurrentTokenVersion {
		return nil, nil, nil
	}

	if hasScope(claims.Scopes, jwt.ScopeAccess) {
		user, err := mng.GetUser(ctx, claims.Subject)
		if err != nil {
			return nil, nil, err
		}

		return claims, user, nil
	}

	// there's a token but it does not have the "access" scope.
	return nil, nil, nil
}

func (mng *Manager) getRefreshToken(ctx context.Context, c echo.Context) (*jwt.Claims, *v1alpha.User, error) {
	tokenValue := cookieValueOrBearer(mng.identityConfg.RefreshTokenCookie, c.Request())
	if tokenValue == "" {
		return nil, nil, nil
	}

	claims, err := mng.VerifyUserToken(tokenValue)
	if err != nil {
		return nil, nil, err
	}

	// skip tokens that don't have our app metadata tag or that use
	// an old token version.
	// This can be useful to immediately revoke an active token
	// by increasing the token version
	if claims.AppMetadata == nil || claims.AppMetadata.TokenVersion != CurrentTokenVersion {
		return nil, nil, nil
	}

	if hasScope(claims.Scopes, jwt.ScopeRefresh) {
		user, err := mng.GetUser(ctx, claims.Subject)
		if err != nil {
			return nil, nil, err
		}

		return claims, user, nil
	}

	// There's a token but it does not have the "refresh" scope.
	return nil, nil, nil
}

func hasScope(haystack []jwt.Scope, needle jwt.Scope) bool {
	for _, s := range haystack {
		if s == needle {
			return true
		}
	}

	return false
}
