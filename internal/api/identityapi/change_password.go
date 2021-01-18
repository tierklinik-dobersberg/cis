package identityapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/service/server"
)

// ChangePasswordEndpoint allows a user to change it's own password.
func ChangePasswordEndpoint(grp gin.IRouter) {
	grp.PUT("v1/profile/password", app.RequireSession(), func(c *gin.Context) {
		appCtx := app.From(c)
		if appCtx == nil {
			return
		}

		body := struct {
			Current     string `json:"current"`
			NewPassword string `json:"newPassword"`
		}{}

		if err := json.NewDecoder(c.Request.Body).Decode(&body); err != nil {
			server.AbortRequest(c, http.StatusBadRequest, err)
			return
		}

		if body.Current == "" {
			server.AbortRequest(c, http.StatusBadRequest, fmt.Errorf("no current password set"))
			return
		}

		if body.NewPassword == "" {
			server.AbortRequest(c, http.StatusBadRequest, fmt.Errorf("password must not be empty"))
			return
		}

		userName := app.SessionUser(c)
		if !appCtx.Identities.Authenticate(c.Request.Context(), userName, body.Current) {
			server.AbortRequest(c, http.StatusBadRequest, errors.New("incorrect password"))
			return
		}

		if err := appCtx.Identities.SetUserPassword(c.Request.Context(), userName, body.NewPassword, "bcrypt"); err != nil {
			server.AbortRequest(c, http.StatusInternalServerError, err)
			return
		}

		c.Status(http.StatusNoContent)
	})
}
