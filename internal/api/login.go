package api

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/userhub/internal/app"
	"github.com/tierklinik-dobersberg/userhub/pkg/models/v1alpha"
)

// LoginEndpoint allows to user to log-in and create a
// session cookie.
//
// POST /api/v1/login
func LoginEndpoint(grp gin.IRouter) {
	grp.POST("v1/login", func(c *gin.Context) {
		var status int
		var user *v1alpha.User

		appCtx := app.From(c)
		if appCtx == nil {
			return
		}

		authHeader := c.Request.Header.Get("Authorization")
		contentType := c.Request.Header.Get("Content-Type")

		if authHeader != "" {
			// There's no session cookie available, check if the user
			// is trying basic-auth.
			status, user = verifyBasicAuth(c.Request.Context(), appCtx.DB, authHeader)

			if status != http.StatusOK {
				c.AbortWithStatus(status)
				return
			}
		} else {
			var username string
			var password string

			if strings.Contains(contentType, "application/json") {
				var req struct {
					Username string `json:"username"`
					Password string `json:"password"`
				}

				if err := json.NewDecoder(c.Request.Body).Decode(&req); err != nil {
					c.Status(http.StatusBadRequest)
					return
				}

				username = req.Username
				password = req.Password
			} else if strings.Contains(contentType, "x-www-form-urlencoded") ||
				strings.Contains(contentType, "multipart/form-data") {

				username = c.Request.FormValue("username")
				password = c.Request.FormValue("password")
			}

			if username != "" && password != "" {
				success := appCtx.DB.Authenticate(c.Request.Context(), username, password)

				if !success {
					c.AbortWithStatus(http.StatusUnauthorized)
					return
				}

				u, err := appCtx.DB.GetUser(c.Request.Context(), username)

				if err != nil {
					c.AbortWithError(http.StatusInternalServerError, err)
					return
				}

				user = &u.User
			}
		}

		if user == nil {
			c.AbortWithStatus(http.StatusUnauthorized)
			return
		}

		cookie := app.CreateSessionCookie(appCtx, user.Name, time.Hour)
		http.SetCookie(c.Writer, cookie)

		rd := c.Query("redirect")
		if rd == "" {
			c.Status(http.StatusOK)
			return
		}

		// TODO(ppacher): verify rd is inside protected domain

		c.Redirect(http.StatusOK, rd)
	})
}
