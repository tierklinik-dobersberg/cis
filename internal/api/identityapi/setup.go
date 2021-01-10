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

	// GET v1/avatar/:user
	AvatarEndpoint(grp)

	// GET v1/users
	ListAllUsersEndpoint(grp)
}
