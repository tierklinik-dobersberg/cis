package customerdb

import (
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"strconv"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Customer defines the customer record.
type Customer struct {
	ID                  primitive.ObjectID `bson:"_id,omitempty"`
	CustomerID          string             `bson:"cid,omitempty"`
	Group               string             `bson:"group,omitempty"`
	Name                string             `bson:"name,omitempty"`
	Firstname           string             `bson:"firstname,omitempty"`
	Title               string             `bson:"title,omitempty"`
	Street              string             `bson:"street,omitempty"`
	CityCode            int                `bson:"cityCode,omitempty"`
	City                string             `bson:"city,omitempty"`
	PhoneNumbers        []string           `bson:"phoneNumbers,omitempty"`
	MailAddresses       []string           `bson:"mailAddresses,omitempty"`
	NameMetaphone       string             `bson:"nameMetaphone,omitempty"`
	VaccinationReminder bool               `bson:"vaccinationReminder,omitempty"`

	// The following fields are not part of the hash
	// calculation but should be updated by importers and
	// may allow more sophisticated synchronization techniques

	// CreateAt holds the time this customer has first been imported.
	CreatedAt time.Time

	// ModifiedAt holds the last time this customer has been updated
	// or re-imported
	ModifiedAt time.Time

	// LinkedTo may be set to link customer or contact data from multiple
	// sources. The format of should follow the typical <source>/<id> notation
	// used in CIS.
	LinkedTo string

	// Metadata holds additional metadata for the customer.
	// It is not part of the hash calculation.
	Metadata map[string]interface{} `bson:"metadata,omitempty"`
	Source   string                 `bson:"customerSource,omitempty"`
}

// Hash returns a hash of the customer
func (cu *Customer) Hash() string {
	h := sha1.New()
	w := func(s string) {
		_, _ = h.Write([]byte(s))
	}

	w(cu.CustomerID)
	w(cu.City)
	w(fmt.Sprintf("%d", cu.CityCode))
	w(cu.Firstname)
	w(cu.Group)
	w(cu.Name)
	w(cu.Source)
	w(strconv.FormatBool(cu.VaccinationReminder))
	for _, p := range cu.PhoneNumbers {
		w(p)
	}
	for _, m := range cu.MailAddresses {
		w(m)
	}
	w(cu.Street)
	w(cu.Title)

	return hex.EncodeToString(h.Sum(nil))
}
