package identityapi

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/nbutton23/zxcvbn-go"
	"github.com/tierklinik-dobersberg/cis/internal/session"
	"github.com/tierklinik-dobersberg/service/server"
)

// PasswordStrengthEndpoint calculates the strength of a password
// using zxcvbn.
func PasswordStrengthEndpoint(grp gin.IRouter) {
	grp.POST(
		"v1/password-check",
		session.Require(),
		func(c *gin.Context) {
			var body struct {
				Password string `json:"password"`
			}

			if err := json.NewDecoder(c.Request.Body).Decode(&body); err != nil {
				server.AbortRequest(c, http.StatusBadRequest, err)
				return
			}

			result := zxcvbn.PasswordStrength(body.Password, nil)

			c.JSON(http.StatusOK, gin.H{
				"entropy":   result.Entropy,
				"crackTime": result.CrackTimeDisplay,
				"score":     result.Score,
			})
		},
	)
}
