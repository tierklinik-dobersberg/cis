package identityapi

import (
	"context"
	"encoding/base64"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/database/identitydb"
	"github.com/tierklinik-dobersberg/cis/pkg/models/identity/v1alpha"
	"github.com/tierklinik-dobersberg/logger"
)

// VerifyEndpoint verifies a permission request.
func VerifyEndpoint(grp gin.IRouter) {
	grp.GET("v1/verify", func(c *gin.Context) {
		var (
			user   *v1alpha.User = nil
			status int           = http.StatusForbidden
			log                  = logger.From(c.Request.Context())
		)

		appCtx := app.From(c)
		if appCtx == nil {
			return
		}

		username, sessionExpiry := app.CheckSession(appCtx, c.Request)
		if username != "" {
			status = http.StatusOK

			// try to get the user from the database, if that fails
			// the auth-request fails as well.
			u, err := appCtx.Identities.GetUser(c.Request.Context(), username)
			if err != nil {
				log.Infof("valid session for deleted user %s", user)
				sessionExpiry = 0
				status = http.StatusForbidden
			} else {
				user = &u.User
			}
		} else if header := c.Request.Header.Get("Authorization"); header != "" {
			// There's no session cookie available, check if the user
			// is trying basic-auth.
			status, user = verifyBasicAuth(c.Request.Context(), appCtx.Identities, header)
			sessionExpiry = 0
		}

		// on success, add user details as headers and
		// make sure there's a valid session cookie.
		if user != nil && status == http.StatusOK {
			c.Set("session:user", user.Name)

			req, err := NewPermissionRequest(c)
			if err != nil {
				logger.From(c.Request.Context()).Infof("failed to create permission request: %s", err)
				c.Status(http.StatusBadRequest)
				return
			}

			allowed, err := appCtx.Matcher.Decide(c.Request.Context(), req)
			if err != nil {
				logger.From(c.Request.Context()).WithFields(req.AsFields()).Infof("failed to decide on permission request: %s", err)
				c.Status(http.StatusBadRequest)
				return
			}

			if !allowed {
				logger.From(c.Request.Context()).WithFields(req.AsFields()).Info("access denied")
				c.Status(http.StatusForbidden)
				return
			}

			addRemoteUserHeaders(*user, c.Writer)

			// make sure we have a valid session and if it's going to
			// expire soon renew it now.
			if sessionExpiry < time.Minute*5 {
				cookie := app.CreateSessionCookie(
					appCtx,
					user.Name,
					time.Hour,
				)
				http.SetCookie(c.Writer, cookie)
			}

			c.Status(status)

			return
		}

		http.SetCookie(
			c.Writer,
			app.ClearSessionCookie(appCtx),
		)
		c.Status(status)
	})
}

func verifyBasicAuth(ctx context.Context, db identitydb.Database, header string) (int, *v1alpha.User) {
	log := logger.From(ctx)

	// We only support "Basic" auth so error out immediately for any
	// other technique.
	if !strings.HasPrefix(header, "Basic ") {
		log.Infof("basic-auth: invalid 'Authorization' header: Only 'Basic' auth is supported. ")
		return http.StatusBadRequest, nil
	}

	// get the base64 encoded user:password string
	blob, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(header, "Basic "))
	if err != nil {
		log.Infof("basic-auth: invalid 'Authorization' header: invalid base64 encoded value")
		return http.StatusBadRequest, nil
	}

	// split user and passwort apart
	parts := strings.SplitN(string(blob), ":", 2)
	if len(parts) != 2 {
		log.Infof("basic-auth: invalid 'Authorization' header: unexpcted number of parts")
		return http.StatusBadRequest, nil
	}

	log.Infof("basic-auth: trying to authenticating user %s", parts[0])

	// and finally try to authenticate the user.
	if db.Authenticate(ctx, parts[0], parts[1]) {
		user, err := db.GetUser(ctx, parts[0])
		if err != nil {
			log.Errorf("basic-auth: failed to retrieve user object for authenticated session %s", parts[0])
			return http.StatusBadRequest, nil
		}

		return http.StatusOK, &user.User
	}
	return http.StatusUnauthorized, nil
}

func addRemoteUserHeaders(u v1alpha.User, w http.ResponseWriter) {
	w.Header().Set("Remote-User", u.Name)
	w.Header().Set("Remote-FullName", u.Fullname)

	for _, mail := range u.Mail {
		w.Header().Add("Remote-Mail", mail)
	}

	for _, phone := range u.PhoneNumber {
		w.Header().Add("Remote-Phone", phone)
	}

	for _, role := range u.Roles {
		w.Header().Add("Remote-Role", role)
	}
}
