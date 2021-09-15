package v1alpha

import (
	"fmt"
	"strings"
	"time"
)

// Customer represents a customer model
type Customer struct {
	// TODO(ppacher): should we actually expose ID?
	ID                  string                 `json:"_id,omitempty" bson:"_id,omitempty"`
	CustomerID          string                 `json:"cid,omitempty" bson:"cid,omitempty"`
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
	CreatedAt           time.Time              `json:"createdAt"`
	ModifiedAt          time.Time              `json:"modifiedAt"`
}

type CustomerRef struct {
	CustomerID string `json:"cid,omitempty" bson:"cid,omitempty"`
	Source     string `json:"source,omitempty" bson:"source,omitempty"`
}

func (ref CustomerRef) String() string {
	return fmt.Sprintf("%s/%s", ref.Source, ref.CustomerID)
}

func ParseRef(s string) *CustomerRef {
	parts := strings.Split(s, "/")
	if len(parts) != 2 {
		return nil
	}
	return &CustomerRef{
		Source:     parts[0],
		CustomerID: parts[1],
	}
}
