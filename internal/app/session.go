package app

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/utils"
	"github.com/tierklinik-dobersberg/logger"
	"github.com/tierklinik-dobersberg/service/server"
)

// ExtractSessionUser extracts the userName of the a HTTP request
// based on the session cookie and adds it to the gin.Context.
func ExtractSessionUser() gin.HandlerFunc {
	return func(c *gin.Context) {
		app := From(c)
		if app != nil {
			user, expiresIn := CheckSession(app, c.Request)

			if user != "" && expiresIn > 0 {
				c.Set("session:user", user)
				c.Set("session:ttl", expiresIn.String())
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

// CreateSessionCookie creates and returns a new session cookie for userName.
func CreateSessionCookie(app *App, userName string, ttl time.Duration) *http.Cookie {
	expires := time.Now().Add(ttl)
	expiresUnix := expires.Unix()
	signature := utils.Signature(app.Config.Secret, app.Config.CookieDomain, userName, fmt.Sprintf("%d", expiresUnix))

	value := fmt.Sprintf("%s:%s:%d", signature, userName, expiresUnix)

	return &http.Cookie{
		Name:     app.Config.CookieName,
		Value:    value,
		Path:     "/",
		Domain:   app.Config.CookieDomain,
		HttpOnly: true,
		Secure:   !app.Config.InsecureCookies,
		Expires:  expires,
	}
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
func CheckSession(app *App, r *http.Request) (userName string, expiresIn time.Duration) {
	log := logger.From(r.Context())

	var sessionCookie *http.Cookie

	for _, ck := range r.Cookies() {
		if ck.Name == app.Config.CookieName {
			sessionCookie = ck
			break
		}
	}

	if sessionCookie == nil {
		log.Info("no session cookie available")
		return "", 0
	}

	parts := strings.Split(sessionCookie.Value, ":")
	if len(parts) != 3 {
		log.Infof("invalid session cookie: unexpected number of parts: %q", sessionCookie.Value)
		return "", 0
	}

	sig := parts[0]
	userName = parts[1]
	expiresStr := parts[2]

	validSig := utils.VerifySignature(sig, app.Config.Secret, app.Config.CookieDomain, userName, expiresStr)
	if !validSig {
		// TODO(ppacher): block the requestor IP as it's obviously tempering
		// with our session cookies?
		log.Info("session cookie has invalid signature for domain")
		return "", 0
	}

	expiresUnix, err := strconv.ParseInt(expiresStr, 10, 64)
	if err != nil {
		log.Infof("session has invalid expiration: %s", err)
		return "", 0
	}

	expires := time.Unix(expiresUnix, 0)

	if expires.Before(time.Now()) {
		log.Info("session cookie is expired")
		return "", 0
	}

	log.Infof("valid session cookie for user %s, expires in %s", userName, expires.Sub(time.Now()))

	return userName, expires.Sub(time.Now())
}
