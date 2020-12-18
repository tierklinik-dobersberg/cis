package v1alpha

// Customer represents a customer model
type Customer struct {
	// TODO(ppacher): should we actually expose ID?
	ID         string `json:"_id,omitempty"`
	CustomerID int    `json:"cid,omitempty"`
	Group      string `json:"group,omitempty"`
	Name       string `json:"name,omitempty"`
	Firstname  string `json:"firstname,omitempty"`
	Title      string `json:"title,omitempty"`
	Street     string `json:"street,omitempty"`
	CityCode   int    `json:"cityCode,omitempty"`
	City       string `json:"city,omitempty"`
	Phone      string `json:"phone,omitempty"`
}
