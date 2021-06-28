package v1alpha

import "fmt"

// User describes the user object.
type User struct {
	Name                string                 `json:"name"`
	Fullname            string                 `json:"fullname"`
	Mail                []string               `json:"mail"`
	PhoneNumber         []string               `json:"phoneNumbers"`
	Roles               []string               `json:"roles" option:"Roles"`
	Properties          map[string]interface{} `json:"properties" option:"-"`
	Color               string                 `json:"color,omitempty"`
	Disabled            bool                   `json:"disabled,omitempty"`
	CalendarID          string                 `json:"calendarID,omitempty"`
	NeedsPasswordChange bool                   `json:"needsPasswordChange,omitempty"`
}

// Role describes a role object. For security and privacy
// reasons the list of members is NOT exposed via the API.
type Role struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

// Permission describes a permission.
type Permission struct {
	Description string   `json:"description"`
	Resources   []string `json:"resources" option:"Resource"`
	Effect      string   `json:"effect"`
	Domains     []string `json:"domain" option:"Domain"`
	Actions     []string `json:"actions" option:"Action"`
}

func (perm *Permission) String() string {
	return fmt.Sprintf("%q: (%s resources=%v domains=%v)", perm.Description, perm.Effect, perm.Resources, perm.Domains)
}
