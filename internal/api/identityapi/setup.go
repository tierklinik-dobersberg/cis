package identityapi

import (
	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
	"github.com/tierklinik-dobersberg/cis/runtime/session"
)

var log = pkglog.New("identityapi")

// Setup sets up all routes for the identity API.
func Setup(grp gin.IRouter) {
	group := app.NewRouter(grp)

	// POST v1/login
	LoginEndpoint(group)

	// POST v1/refresh
	RefreshEndpoint(group)

	router := group.Group("", session.Require())

	// GET v1/login
	GetSessionStatus(router)

	// GET v1/verify
	VerifyEndpoint(router)

	// POST v1/permissions/test
	TestPermissionEndpoint(router)

	// GET v1/profile
	ProfileEndpoint(router)

	// PUT v1/profile/password
	ChangePasswordEndpoint(router)

	// POST v1/password-check
	PasswordStrengthEndpoint(router)

	// GET v1/avatar/:user
	AvatarEndpoint(router)

	// GET v1/users
	ListAllUsersEndpoint(router)

	// POST v1/logout
	LogoutEndpoint(router)
}
