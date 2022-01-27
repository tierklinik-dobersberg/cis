package identityapi

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/labstack/echo/v4"
	"github.com/nbutton23/zxcvbn-go"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/runtime/session"
)

// PasswordStrengthEndpoint calculates the strength of a password
// using zxcvbn.
func PasswordStrengthEndpoint(grp *app.Router) {
	grp.POST(
		"v1/password-check",
		permission.Anyone,
		func(ctx context.Context, app *app.App, c echo.Context) error {
			var body struct {
				Password string `json:"password"`
			}

			if err := json.NewDecoder(c.Request().Body).Decode(&body); err != nil {
				return httperr.BadRequest().SetInternal(err)
			}

			result := zxcvbn.PasswordStrength(body.Password, nil)

			c.JSON(http.StatusOK, gin.H{
				"entropy":   result.Entropy,
				"crackTime": result.CrackTimeDisplay,
				"score":     result.Score,
			})
			return nil
		},
		session.Require(),
	)
}
