package v1alpha

import "fmt"

// User describes the user object.
type User struct {
	Name                string                 `json:"name" bson:"name,omitempty"`
	Fullname            string                 `json:"fullname" bson:"fullname,omitempty"`
	Mail                []string               `json:"mail" bson:"mail,omitempty"`
	PhoneNumber         []string               `json:"phoneNumbers" bson:"phoneNumbers,omitempty"`
	Roles               []string               `json:"roles" option:"Roles" bson:"roles,omitempty"`
	Properties          map[string]interface{} `json:"properties" option:"-" bson:"properties,omitempty"`
	Color               string                 `json:"color,omitempty" bson:"color,omitempty"`
	Disabled            bool                   `json:"disabled,omitempty" bson:"disabled,omitempty"`
	CalendarID          string                 `json:"calendarID,omitempty" bson:"calendarID,omitempty"`
	NeedsPasswordChange bool                   `json:"needsPasswordChange,omitempty" bson:"needsPasswordChange,omitempty"`
}

// Role describes a role object. For security and privacy
// reasons the list of members is NOT exposed via the API.
type Role struct {
	Name        string `json:"name" bson:"name"`
	Description string `json:"description" bson:"description,omitempty"`
}

// Permission describes a permission.
type Permission struct {
	Description string   `json:"description" bson:"description,omitempty"`
	Resources   []string `json:"resources" option:"Resource" bson:"resources,omitempty"`
	Effect      string   `json:"effect" bson:"effect,omitempty"`
	Domains     []string `json:"domain" option:"Domain" bson:"domains,omitempty"`
	Actions     []string `json:"actions" option:"Action" bson:"actions,omitempty"`
}

func (perm *Permission) String() string {
	return fmt.Sprintf("%q: (%s resources=%v domains=%v)", perm.Description, perm.Effect, perm.Resources, perm.Domains)
}
