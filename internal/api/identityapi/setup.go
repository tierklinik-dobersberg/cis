package identityapi

import (
	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
)

var log = pkglog.New("identityapi")

// Setup sets up all routes for the identity API.
func Setup(a *app.App, grp *echo.Group) {
	router := app.NewRouter(grp, a)

	// POST v1/login
	LoginEndpoint(router)

	// POST v1/refresh
	RefreshEndpoint(router)

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

	// POST/PUT v1/users/:user
	CreateEditUserEndpoint(router)
}
