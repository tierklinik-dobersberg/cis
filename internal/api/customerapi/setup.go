package customerapi

import "github.com/gin-gonic/gin"

func Setup(grp gin.IRouter) {
	GetCustomerEndpoint(grp)
	SearchCustomerEndpoint(grp)
	FuzzySearchCustomerEndpoint(grp)
}
