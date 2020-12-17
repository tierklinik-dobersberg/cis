package v1alpha

import "fmt"

// User describes the user object.
type User struct {
	Name        string                 `json:"name"`
	Fullname    string                 `json:"fullname"`
	Mail        []string               `json:"mail"`
	PhoneNumber []string               `json:"phoneNumbers"`
	GroupNames  []string               `json:"groups" option:"MemberOf"`
	Properties  map[string]interface{} `json:"properties" option:"-"`
}

// Group describes a group object. For security and privacy
// reasons the list of members is NOT exposed via the API.
type Group struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

// Permission describes a permission.
type Permission struct {
	Description string   `json:"description"`
	Resources   []string `json:"resources" option:"Resource"`
	Effect      string   `json:"effect"`
	Domains     []string `json:"domain" option:"Domain"`
}

func (perm *Permission) String() string {
	return fmt.Sprintf("%q: (%s resources=%v domains=%v)", perm.Description, perm.Effect, perm.Resources, perm.Domains)
}
