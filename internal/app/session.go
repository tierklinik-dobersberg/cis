package app

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/jwt"
	"github.com/tierklinik-dobersberg/cis/internal/utils"
	"github.com/tierklinik-dobersberg/cis/pkg/models/identity/v1alpha"
	"github.com/tierklinik-dobersberg/service/server"
)

// ExtractSessionUser extracts the userName of the a HTTP request
// based on the session cookie and adds it to the gin.Context.
func ExtractSessionUser() gin.HandlerFunc {
	return func(c *gin.Context) {
		app := From(c)
		if app != nil {
			claims, expiresIn := CheckSession(app, c.Request)

			if claims != nil && expiresIn > 0 {
				c.Set("session:user", claims.Subject)
				c.Set("session:ttl", expiresIn.String())
				if claims.AppMetadata != nil && claims.AppMetadata.Authorization != nil {
					c.Set("session:roles", claims.AppMetadata.Authorization.Roles)
				}

				c.Request = c.Request.Clone(context.WithValue(c.Request.Context(), utils.ContextUserKey{}, claims))
			}
		}

		c.Next()
	}
}

// RequireSession returns a gin handler function that
// ensures a valid session cookie is available. If not,
// the request is terminated with 401 Unauthorized.
// Note that ExtractSessionUser must be used for RequireSession
// to work.
func RequireSession() gin.HandlerFunc {
	return func(c *gin.Context) {
		usr := SessionUser(c)
		if usr == "" {
			server.AbortRequest(c, http.StatusUnauthorized, errors.New("no session cookie"))
			return
		}

		c.Next()
	}
}

// SessionUser returns the name of the user associated with c.
func SessionUser(c *gin.Context) string {
	val, ok := c.Get("session:user")
	if !ok {
		return ""
	}

	u, _ := val.(string)
	return u
}

// SessionRoles returns the roles assigned to a session.
func SessionRoles(c *gin.Context) []string {
	val, ok := c.Get("session:roles")
	if !ok {
		return nil
	}
	roles, _ := val.([]string)
	return roles
}

// CreateSessionCookie creates and returns a new session cookie for userName.
func CreateSessionCookie(app *App, user v1alpha.User, ttl time.Duration) (*http.Cookie, error) {
	token, err := app.CreateUserToken(user, ttl)
	if err != nil {
		return nil, err
	}

	return &http.Cookie{
		Name:     app.Config.CookieName,
		Value:    token,
		Path:     "/",
		Domain:   app.Config.CookieDomain,
		HttpOnly: true,
		Secure:   !app.Config.InsecureCookies,
		Expires:  time.Now().Add(ttl),
	}, nil
}

// ClearSessionCookie returns a cookie that can be used
// to clear an existing session cookie.
func ClearSessionCookie(app *App) *http.Cookie {
	return &http.Cookie{
		Name:     app.Config.CookieName,
		Value:    "",
		Path:     "/",
		Domain:   app.Config.CookieDomain,
		HttpOnly: true,
		Secure:   !app.Config.InsecureCookies,
		Expires:  time.Now().Add(-time.Hour),
	}
}

// CheckSession checks and validates the session cookie of r (if any).
// It returns the associated username and the time-to-live.
func CheckSession(app *App, r *http.Request) (claims *jwt.Claims, expiresIn time.Duration) {
	var tokenValue string
	sessionCookie, err := r.Cookie(app.Config.CookieName)
	if err != nil {
		if h := r.Header.Get("Authorization"); strings.HasPrefix(h, "Bearer ") {
			tokenValue = strings.TrimPrefix(h, "Bearer ")
		}
	} else {
		tokenValue = sessionCookie.Value
	}

	if tokenValue == "" {
		return nil, 0
	}

	claims, err = jwt.ParseAndVerify([]byte(app.Config.Secret), tokenValue)
	if err != nil {
		return nil, 0
	}

	return claims, time.Unix(claims.ExpiresAt, 0).Sub(time.Now())
}
