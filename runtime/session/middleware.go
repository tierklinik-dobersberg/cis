package session

import (
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/http/httputil"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/pkg/jwt"
	"github.com/tierklinik-dobersberg/cis/pkg/models/identity/v1alpha"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
	"github.com/tierklinik-dobersberg/logger"
)

var log = pkglog.New("session")

// Middleware is a echo MiddlewareFunc that extracts session data from incoming
// HTTP requests and handles automatic issuing of new access tokens for
// provided refresh tokens.
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

		// get access and refresh tokens
		//
		accessToken, accessUser, err := mng.getAccessToken(c)
		if err != nil {
			log.V(3).Logf("failed to get access token: %s", err)
			return err
		}
		refreshToken, refreshUser, err := mng.getRefreshToken(c)
		if err != nil {
			log.V(3).Logf("failed to get refresh token: %s", err)
			return err
		}

		// if there's neither a refresh nor an access token we'll
		// skip it.
		if refreshToken == nil && accessToken == nil {
			log.V(3).Log("unauthenticated request: no access or refresh token provided")

			reqBlob, err := httputil.DumpRequest(c.Request(), true)
			if err != nil {
				log.Errorf("failed to dump request: %s", err)
				return err
			}
			if err := ioutil.WriteFile("/log/request.dump", reqBlob, 0600); err != nil {
				log.Errorf("failed to dump request: %s", err)
			}

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
			return httperr.InternalError().SetInternal(
				fmt.Errorf("failed to find user for token"),
			)
		}

		if user.Disabled {
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
		if mng.sessionIDCookie != "" {
			sid, err := c.Cookie(mng.sessionIDCookie)
			if err != nil && !errors.Is(err, http.ErrNoCookie) {
				return httperr.InternalError().SetInternal(err)
			}
			if err == nil {
				session = mng.getSessionByID(sid.Value)
				if session != nil {
					// there's a session with that sid, make sure
					// the user is the same ...
					if session.User.Name != user.Name {
						log.V(3).Log("request denied: sid-user does not match access token")
						return httperr.BadRequest("session ID user does not match access token")
					}
				}
			}
		}

		if session == nil {
			// there's no existing session (that did a /login)
			// so just create a new one and use that
			session = &Session{
				User:       *user,
				lastAccess: time.Now(),
				destroyed:  make(chan struct{}),
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
			// save it as active
			if err := mng.saveSession(session, c.Response()); err != nil {
				log.V(3).Logf("failed to save session: %s", err)
			}
		}

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

func (mng *Manager) getSessionByID(id string) *Session {
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

func (mng *Manager) getAccessToken(c echo.Context) (*jwt.Claims, *v1alpha.User, error) {
	tokenValue := cookieValueOrBearer(mng.identityConfg.AccessTokenCookie, c.Request())
	if tokenValue == "" {
		return nil, nil, nil
	}

	claims, err := mng.VerifyUserToken(tokenValue)
	if err != nil {
		return nil, nil, err
	}

	if hasScope(claims.Scopes, jwt.ScopeAccess) {
		user, err := mng.GetUser(c.Request().Context(), claims.Subject)
		if err != nil {
			return nil, nil, err
		}

		return claims, user, nil
	}

	// there's a token but it does not have the "access" scope.
	return nil, nil, nil
}

func (mng *Manager) getRefreshToken(c echo.Context) (*jwt.Claims, *v1alpha.User, error) {
	tokenValue := cookieValueOrBearer(mng.identityConfg.RefreshTokenCookie, c.Request())
	if tokenValue == "" {
		return nil, nil, nil
	}

	claims, err := mng.VerifyUserToken(tokenValue)
	if err != nil {
		return nil, nil, err
	}

	if hasScope(claims.Scopes, jwt.ScopeRefresh) {
		user, err := mng.GetUser(c.Request().Context(), claims.Subject)
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
