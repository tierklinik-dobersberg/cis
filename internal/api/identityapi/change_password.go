package identityapi

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/runtime/session"
)

// ChangePasswordEndpoint allows a user to change it's own password.
func ChangePasswordEndpoint(grp *app.Router) {
	grp.PUT(
		"v1/profile/password",
		permission.Anyone,
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			body := struct {
				Current     string `json:"current"`
				NewPassword string `json:"newPassword"`
			}{}

			if err := json.NewDecoder(c.Request.Body).Decode(&body); err != nil {
				return httperr.BadRequest(err, "invalid body")
			}

			if body.Current == "" {
				return httperr.MissingField("current")
			}

			if body.NewPassword == "" {
				return httperr.MissingField("newPassword")
			}

			sess := session.Get(c)
			if !app.Identities.Authenticate(ctx, sess.User.Name, body.Current) {
				return httperr.BadRequest(nil)
			}

			if err := app.Identities.SetUserPassword(ctx, sess.User.Name, body.NewPassword, "bcrypt"); err != nil {
				return err
			}

			c.Status(http.StatusNoContent)
			return nil
		},
	)
}
