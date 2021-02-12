package permission

import "github.com/gin-gonic/gin"

// Set is a list of actions that the session must
// be allowed to perform in order to be allowed to use an
// API endpoint.
type Set []*Action

// Anyone defines that anyone can use the annotated API.
// It's equal to using a nil or empty Set.
var Anyone = Set{}

// Require is a gin middleware that enforces
// permission requirements.
func Require(set Set) gin.HandlerFunc {
	return func(c *gin.Context) {

	}
}
