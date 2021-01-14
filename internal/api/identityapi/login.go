package identityapi

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/pkg/models/identity/v1alpha"
	"github.com/tierklinik-dobersberg/logger"
	"github.com/tierklinik-dobersberg/service/server"
)

func removeSetSessionCookie(appCtx *app.App, w http.ResponseWriter) {
	const cookieHeader = "Set-Cookie"
	existingCookies := w.Header().Values(cookieHeader)
	w.Header().Del(cookieHeader)

	for _, e := range existingCookies {
		if !strings.Contains(e, appCtx.Config.CookieName) {
			w.Header().Add(cookieHeader, e)
		}
	}
}

// LoginEndpoint allows to user to log-in and create a
// session cookie.
func LoginEndpoint(grp gin.IRouter) {
	grp.POST("v1/login", func(c *gin.Context) {
		var (
			status int
			user   *v1alpha.User
		)

		log := logger.From(c.Request.Context())

		appCtx := app.From(c)
		if appCtx == nil {
			return
		}

		// Autologin may have assigned a new session cookie for the
		// request. Make sure we clear that out for the login
		// endpoint.
		// TODO(ppacher): maybe make some endpoints skippable by the
		// autologin manager?
		removeSetSessionCookie(appCtx, c.Writer)

		authHeader := c.Request.Header.Get("Authorization")
		contentType := c.Request.Header.Get("Content-Type")

		if authHeader != "" {
			// There's no session cookie available, check if the user
			// is trying basic-auth.
			log.Infof("performing authentication against 'Authorization' header.")
			status, user = verifyBasicAuth(c.Request.Context(), appCtx.Identities, authHeader)

			if status != http.StatusOK {
				log.Infof("basic authentication failed.")
				c.AbortWithStatus(status)
				return
			}
		} else {
			var (
				username string
				password string
			)

			if strings.Contains(contentType, "application/json") {
				log.Infof("performing authentication from application/json payload.")

				var req struct {
					Username string `json:"username"`
					Password string `json:"password"`
				}

				if err := json.NewDecoder(c.Request.Body).Decode(&req); err != nil {
					server.AbortRequest(c, http.StatusBadRequest, err)
					return
				}

				username = req.Username
				password = req.Password
			} else if strings.Contains(contentType, "x-www-form-urlencoded") ||
				strings.Contains(contentType, "multipart/form-data") {

				log.Infof("performing authentication from x-www-form-urlencoded or multipart/form-data payload.")
				username = c.Request.FormValue("username")
				password = c.Request.FormValue("password")
			}

			if username != "" && password != "" {
				success := appCtx.Identities.Authenticate(c.Request.Context(), username, password)

				if !success {
					log.Infof("failed to authenticate %q", username)
					c.AbortWithStatus(http.StatusUnauthorized)
					return
				}

				u, err := appCtx.Identities.GetUser(c.Request.Context(), username)

				if err != nil {
					log.Infof("failed to retrieve authenticated user %q", username)
					c.AbortWithError(http.StatusInternalServerError, err)
					return
				}

				user = &u.User
			}
		}

		if user == nil {
			claims, expiresIn := app.CheckSession(appCtx, c.Request)
			// check if there's a valid session cookie
			if claims != nil {
				u, err := appCtx.Identities.GetUser(c.Request.Context(), claims.Subject)
				if err != nil {
					server.AbortRequest(c, http.StatusInternalServerError, err)
					return
				}

				user = &u.User

				log = log.WithFields(logger.Fields{
					"user": user.Name,
				})

				// If the cookie is still valid just return immediately without
				// creating a new session cookie.
				// TODO(ppacher): make configurable
				if expiresIn > 5*time.Minute {
					log.Infof("accepting request as cookie is still valid for %s", expiresIn)
					c.Status(http.StatusOK)
					return
				}

				log.Infof("session expiration in %s, auto-renewing token", expiresIn)
			}
		} else {
			log = log.WithFields(logger.Fields{
				"user": user.Name,
			})
		}

		if user == nil {
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}

		cookie, err := app.CreateSessionCookie(appCtx, *user, time.Hour)
		if err != nil {
			c.AbortWithStatus(http.StatusInternalServerError)
			log.Errorf("failed to create session token: %s for %s", user.Name, err)
			return
		}
		http.SetCookie(c.Writer, cookie)

		rd := c.Query("redirect")
		if rd == "" {
			c.Status(http.StatusOK)
			return
		}

		// TODO(ppacher): verify rd is inside protected domain

		c.Redirect(http.StatusFound, rd)
	})
}
