package identityapi

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/pkg/models/identity/v1alpha"
	"github.com/tierklinik-dobersberg/cis/runtime/session"
	"github.com/tierklinik-dobersberg/logger"
)

func removeSetSessionCookie(app *app.App, w http.ResponseWriter) {
	const cookieHeader = "Set-Cookie"
	existingCookies := w.Header().Values(cookieHeader)
	w.Header().Del(cookieHeader)

	for _, e := range existingCookies {
		if !strings.Contains(e, app.Config.AccessTokenCookie) &&
			!strings.Contains(e, app.Config.RefreshTokenCookie) {
			w.Header().Add(cookieHeader, e)
		}
	}
}

func GetSessionStatus(grp *app.Router) {
	grp.GET(
		"v1/login",
		permission.Anyone,
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			sess := session.Get(c)
			if sess == nil {
				return httperr.Forbidden(nil, "not allowed")
			}

			r := gin.H{
				"user":     sess.User.Name,
				"mail":     sess.User.Mail,
				"fullname": sess.User.Fullname,
			}

			if sess.AccessUntil != nil {
				r["access"] = sess.AccessUntil.Format(time.RFC3339)
			}
			if sess.RefreshUntil != nil {
				r["refresh"] = sess.RefreshUntil.Format(time.RFC3339)
			}

			c.JSON(http.StatusOK, r)
			return nil
		},
	)
}

// LoginEndpoint allows to user to log-in and create a
// session cookie.
func LoginEndpoint(grp *app.Router) {
	grp.POST(
		"v1/login",
		permission.Anyone,
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			var user *v1alpha.User

			log := log.From(ctx)

			// Autologin may have assigned a new session cookie for the
			// request. Make sure we clear that out for the login
			// endpoint.
			// TODO(ppacher): maybe make some endpoints skippable by the
			// autologin manager?
			removeSetSessionCookie(app, c.Writer)

			authHeader := c.Request.Header.Get("Authorization")
			contentType := c.Request.Header.Get("Content-Type")

			if authHeader != "" {
				// There's no session cookie available, check if the user
				// is trying basic-auth.
				log.Infof("performing authentication against 'Authorization' header.")
				var err error
				user, err = verifyBasicAuth(ctx, app.Identities, authHeader)
				if err != nil {
					return err
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
						return httperr.BadRequest(err, "invalid JSON encoded body")
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
					success := app.Identities.Authenticate(ctx, username, password)

					if !success {
						log.Infof("failed to authenticate %q", username)
						c.AbortWithStatus(http.StatusUnauthorized)
						return nil
					}

					u, err := app.Identities.GetUser(ctx, username)

					if err != nil {
						log.Errorf("failed to retrieve authenticated user %q", username)
						return httperr.InternalError(err) // make sure we send 500 instead of 404
					}

					user = &u.User
				}
			}

			if user == nil {
				sess := session.Get(c)

				// check if there's a valid session cookie
				if sess != nil {
					user = &sess.User

					log = log.WithFields(logger.Fields{
						"user": user.Name,
					})

					// If the cookie is still valid just return immediately without
					// creating a new session cookie.
					// TODO(ppacher): make configurable
					if sess.AccessUntil != nil && time.Until(*sess.AccessUntil) > 5*time.Minute {
						log.Infof("accepting request as cookie is still valid until %s", sess.AccessUntil)
						c.Status(http.StatusOK)
						return nil
					}

					log.Infof("session expiration at %s, auto-renewing token", sess.AccessUntil)
				}
			}

			if user == nil {
				c.AbortWithStatus(http.StatusUnauthorized)
				return nil
			}

			sess, accessToken, err := app.Sessions.Create(*user, c.Writer)
			if err != nil {
				c.AbortWithStatus(http.StatusInternalServerError)
			}
			session.Set(c, sess)

			rd := c.Query("redirect")
			if rd == "" {
				c.JSON(http.StatusOK, gin.H{
					"token": accessToken,
				})
				return nil
			}

			// TODO(ppacher): verify rd is inside protected domain
			c.Redirect(http.StatusFound, rd)
			return nil
		},
	)
}
