package holidayapi

import "github.com/gin-gonic/gin"

// Setup configures the holidayapi endpoints.
func Setup(grp gin.IRouter) {
	// GET /api/holidays/v1/:year
	GetForYearEndpoint(grp)

	// GET /api/holidays/v1/:year/:month
	GetForMonthEndpoint(grp)
}
