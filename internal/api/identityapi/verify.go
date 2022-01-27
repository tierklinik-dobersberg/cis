package identityapi

import (
	"context"
	"encoding/base64"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/identity"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/pkg/models/identity/v1alpha"
	"github.com/tierklinik-dobersberg/cis/runtime/session"
)

// VerifyEndpoint verifies a permission request.
func VerifyEndpoint(grp *app.Router) {
	grp.GET(
		"v1/verify",
		permission.Anyone,
		func(ctx context.Context, app *app.App, c echo.Context) error {
			log := log.From(ctx)

			sess := session.Get(c)
			if sess == nil {
				return httperr.Forbidden()
			}

			// on success, add user details as headers and
			// make sure there's a valid session cookie.
			c.Set("session:user", sess.User.Name)

			// TODO(ppacher): we do not yet support auto-assiged roles
			// in permission checks.
			//
			// Use autologin.Manager.GetAutoAssignedRoles(c.Request) and
			// add them to the permission request.
			//
			req, err := NewPermissionRequest(ctx, c)
			if err != nil {
				return httperr.InternalError().SetInternal(err)
			}

			allowed, err := app.Matcher.Decide(ctx, req, sess.ExtraRoles())
			if err != nil {
				return httperr.InternalError().SetInternal(err)
			}

			if !allowed {
				log.WithFields(req.AsFields()).Info("access denied")
				return httperr.Forbidden()
			}

			addRemoteUserHeaders(sess.User, c.Response())

			c.NoContent(http.StatusOK)
			return nil
		},
		session.Require(),
	)
}

func verifyBasicAuth(ctx context.Context, db identity.Provider, header string) (*v1alpha.User, error) {
	log := log.From(ctx)

	// We only support "Basic" auth so error out immediately for any
	// other technique.
	if !strings.HasPrefix(header, "Basic ") {
		log.Infof("basic-auth: invalid 'Authorization' header: Only 'Basic' auth is supported. ")
		return nil, httperr.BadRequest("invalid authorization header")
	}

	// get the base64 encoded user:password string
	blob, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(header, "Basic "))
	if err != nil {
		log.Infof("basic-auth: invalid 'Authorization' header: invalid base64 encoded value")
		return nil, httperr.BadRequest("invalid authorization header")
	}

	// split user and passwort apart
	parts := strings.SplitN(string(blob), ":", 2)
	if len(parts) != 2 {
		log.Infof("basic-auth: invalid 'Authorization' header: unexpcted number of parts")
		return nil, httperr.BadRequest("invalid authorization header")
	}

	log.Infof("basic-auth: trying to authenticating user %s", parts[0])

	// and finally try to authenticate the user.
	if db.Authenticate(ctx, parts[0], parts[1]) {
		user, err := db.GetUser(ctx, parts[0])
		if err != nil {
			log.Errorf("basic-auth: failed to retrieve user object for authenticated session %s", parts[0])
			return nil, httperr.BadRequest("invalid authorization header")
		}

		return &user.User, nil
	}
	return nil, httperr.Unauthorized("authentication failed")
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
