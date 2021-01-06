package autologin

import "github.com/tierklinik-dobersberg/cis/internal/database/identitydb"

// Manager manages and grants automatic user logins.
type Manager struct {
	identiy identitydb.Database

	// users holds all conditions that must be fullfilled for a request
	// to be granted a session token using automatic-login.
	users map[string][]Condition
}
