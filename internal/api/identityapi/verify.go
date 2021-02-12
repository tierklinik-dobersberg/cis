package identityapi

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/database/identitydb"
	"github.com/tierklinik-dobersberg/cis/internal/httperr"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/internal/session"
	"github.com/tierklinik-dobersberg/cis/pkg/models/identity/v1alpha"
	"github.com/tierklinik-dobersberg/logger"
)

// VerifyEndpoint verifies a permission request.
func VerifyEndpoint(grp *app.Router) {
	grp.GET(
		"v1/verify",
		permission.Anyone,
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			log := logger.From(ctx)

			sess := session.Get(c)
			if sess == nil {
				return httperr.New(http.StatusUnauthorized, fmt.Errorf("not authenticated"), nil)
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
				return httperr.InternalError(err)
			}

			allowed, err := app.Matcher.Decide(ctx, req)
			if err != nil {
				return httperr.InternalError(err)
			}

			if !allowed {
				log.WithFields(req.AsFields()).Info("access denied")
				return httperr.New(http.StatusForbidden, fmt.Errorf("access denied"), nil)
			}

			addRemoteUserHeaders(sess.User, c.Writer)

			c.Status(http.StatusOK)
			return nil
		},
	)
}

func verifyBasicAuth(ctx context.Context, db identitydb.Database, header string) (*v1alpha.User, error) {
	log := logger.From(ctx)

	// We only support "Basic" auth so error out immediately for any
	// other technique.
	if !strings.HasPrefix(header, "Basic ") {
		log.Infof("basic-auth: invalid 'Authorization' header: Only 'Basic' auth is supported. ")
		return nil, httperr.BadRequest(nil, "invalid authorization header")
	}

	// get the base64 encoded user:password string
	blob, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(header, "Basic "))
	if err != nil {
		log.Infof("basic-auth: invalid 'Authorization' header: invalid base64 encoded value")
		return nil, httperr.BadRequest(nil, "invalid authorization header")
	}

	// split user and passwort apart
	parts := strings.SplitN(string(blob), ":", 2)
	if len(parts) != 2 {
		log.Infof("basic-auth: invalid 'Authorization' header: unexpcted number of parts")
		return nil, httperr.BadRequest(nil, "invalid authorization header")
	}

	log.Infof("basic-auth: trying to authenticating user %s", parts[0])

	// and finally try to authenticate the user.
	if db.Authenticate(ctx, parts[0], parts[1]) {
		user, err := db.GetUser(ctx, parts[0])
		if err != nil {
			log.Errorf("basic-auth: failed to retrieve user object for authenticated session %s", parts[0])
			return nil, httperr.BadRequest(nil, "invalid authorization header")
		}

		return &user.User, nil
	}
	return nil, httperr.WithCode(http.StatusUnauthorized, errors.New("authentication failed"))
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
