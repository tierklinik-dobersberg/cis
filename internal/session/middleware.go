package session

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/jwt"
	"github.com/tierklinik-dobersberg/cis/pkg/models/identity/v1alpha"
)

// Middleware extracts session data from incoming HTTP requests
// and handles automatic issueing of new access tokens for
// provided refresh tokens.
func Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		app := app.From(c)
		if app == nil {
			return
		}

		aborted := false
		defer func() {
			if aborted {
				return
			}
			c.Next()
		}()

		// if someone else already added a session we'll skip
		// everything here.
		session := Get(c)
		if session != nil {
			return
		}

		// get access and refresh tokens
		//
		accessToken, accessUser, err := getAccessToken(app, c)
		if err != nil {
			aborted = true
			c.AbortWithStatus(http.StatusBadRequest)
			return
		}
		refreshToken, refreshUser, err := getRefreshToken(app, c)
		if err != nil {
			aborted = true
			c.AbortWithStatus(http.StatusBadRequest)
			return
		}

		// if there's neither a refresh nor an access token we'll
		// skip it.
		if refreshToken == nil && accessToken == nil {
			return
		}

		// If we have access and refresh tokens they MUST belong to the same user!
		if accessUser != nil && refreshUser != nil && accessUser.Name != refreshUser.Name {
			aborted = true
			// TODO(ppacher): INCIDENT!
			c.AbortWithStatus(http.StatusBadRequest)
			return
		}

		user := accessUser
		if user == nil {
			user = refreshUser
		}
		if user == nil {
			aborted = true
			c.AbortWithStatus(http.StatusInternalServerError)
			return
		}

		// at this point we have a valid session
		// (either access scope, refresh scope or both)
		session = &Session{
			User:  *user,
			Roles: user.Roles,
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

		// if we have a valid refresh-scoped token we might
		// just issue a new access token here
		if session.RefreshUntil != nil {
			if session.AccessUntil == nil || session.AccessUntil.Sub(time.Now()) < time.Minute*5 {
				accessToken, _, err := GenerateAccessToken(app, *user)
				if err != nil {
					aborted = true
					c.AbortWithStatus(http.StatusInternalServerError)
					return
				}

				accessCookie := CreateCookie(app, app.Config.AccessTokenCookie, accessToken, app.Config.AccessTokenTTL)
				session.AccessUntil = &accessCookie.Expires

				http.SetCookie(c.Writer, accessCookie)
			}
		}

		// if we don't have a valid access-scope now
		// abort.
		if session.AccessUntil == nil {
			return
		}

		// add the session to the gin context.
		Set(c, session)
	}
}

// Require aborts an incoming http request if it does not have
// a valid session token.
func Require() gin.HandlerFunc {
	return func(c *gin.Context) {
		if Get(c) == nil {
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}

		c.Next()
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

func getAccessToken(app *app.App, c *gin.Context) (*jwt.Claims, *v1alpha.User, error) {
	tokenValue := cookieValueOrBearer(app.Config.AccessTokenCookie, c.Request)
	if tokenValue == "" {
		return nil, nil, nil
	}

	claims, err := VerifyUserToken(app, tokenValue)
	if err != nil {
		return nil, nil, err
	}

	if hasScope(claims.Scopes, jwt.ScopeAccess) {
		user, err := app.Identities.GetUser(c.Request.Context(), claims.Subject)
		if err != nil {
			return nil, nil, err
		}

		return claims, &user.User, nil
	}

	// there's a token but it does not have the "access" scope.
	return nil, nil, nil
}

func getRefreshToken(app *app.App, c *gin.Context) (*jwt.Claims, *v1alpha.User, error) {
	tokenValue := cookieValueOrBearer(app.Config.RefreshTokenCookie, c.Request)
	if tokenValue == "" {
		return nil, nil, nil
	}

	claims, err := VerifyUserToken(app, tokenValue)
	if err != nil {
		return nil, nil, err
	}

	if hasScope(claims.Scopes, jwt.ScopeRefresh) {
		user, err := app.Identities.GetUser(c.Request.Context(), claims.Subject)
		if err != nil {
			return nil, nil, err
		}

		return claims, &user.User, nil
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
