package identityapi

import "github.com/gin-gonic/gin"

// Setup sets up all routes for the identity API.
func Setup(grp gin.IRouter) {
	// POST v1/login
	LoginEndpoint(grp)

	// GET v1/verify
	VerifyEndpoint(grp)

	// GET v1/profile
	ProfileEndpoint(grp)

	// PUT v1/profile/password
	ChangePasswordEndpoint(grp)

	// POST v1/password-check
	PasswordStrengthEndpoint(grp)

	// GET v1/avatar/:user
	AvatarEndpoint(grp)

	// GET v1/users
	ListAllUsersEndpoint(grp)

	// POST v1/logout
	LogoutEndpoint(grp)
}
