package autologin

import "net/http"

// Condition is something a HTTP request must fullfill in oder to be
// granted a session token through automatic user login.
type Condition interface {
	// Matches checks if r matches the condition. In case of an error
	// Matches returns false and the error.
	Matches(r *http.Request) (bool, error)
}
