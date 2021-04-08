package v1alpha

// Customer represents a customer model
type Customer struct {
	// TODO(ppacher): should we actually expose ID?
	ID                  string                 `json:"_id,omitempty" bson:"_id,omitempty"`
	CustomerID          int                    `json:"cid,omitempty" bson:"cid,omitempty"`
	Group               string                 `json:"group,omitempty" bson:"group,omitempty"`
	Name                string                 `json:"name,omitempty" bson:"name,omitempty"`
	Firstname           string                 `json:"firstname,omitempty" bson:"firstname,omitempty"`
	Title               string                 `json:"title,omitempty" bson:"title,omitempty"`
	Street              string                 `json:"street,omitempty" bson:"street,omitempty"`
	CityCode            int                    `json:"cityCode,omitempty" bson:"cityCode,omitempty"`
	City                string                 `json:"city,omitempty" bson:"city,omitempty"`
	PhoneNumbers        []string               `json:"phoneNumbers,omitempty" bson:"phoneNumbers,omitempty"`
	MailAddresses       []string               `json:"mailAddresses,omitempty" bson:"mailAddresses,omitempty"`
	Metadata            map[string]interface{} `json:"metadata,omitempty" bson:"metadata,omitempty"`
	Source              string                 `json:"source,omitempty" bson:"source,omitempty"`
	VaccinationReminder bool                   `json:"vaccinationReminder" bson:"vaccinationReminder,omitempty"`
}
