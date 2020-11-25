package v1alpha

// User describes the user object.
type User struct {
	Name        string   `json:"name"`
	Fullname    string   `json:"fullname"`
	Mail        []string `json:"mail"`
	PhoneNumber []string `json:"phoneNumbers"`
	GroupNames  []string `json:"groups"`
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
	Resources   []string `json:"resources"`
	Effect      string   `json:"effect"`
	Domains     []string `json:"domain"`
}
