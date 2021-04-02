package customerdb

import (
	"crypto/sha1"
	"encoding/hex"
	"fmt"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Customer defines the customer record.
type Customer struct {
	ID            primitive.ObjectID `bson:"_id,omitempty"`
	CustomerID    int                `bson:"cid,omitempty"`
	Group         string             `bson:"group,omitempty"`
	Name          string             `bson:"name,omitempty"`
	Firstname     string             `bson:"firstname,omitempty"`
	Title         string             `bson:"title,omitempty"`
	Street        string             `bson:"street,omitempty"`
	CityCode      int                `bson:"cityCode,omitempty"`
	City          string             `bson:"city,omitempty"`
	PhoneNumbers  []string           `bson:"phoneNumbers,omitempty"`
	MailAddresses []string           `bson:"mailAddresses,omitempty"`
	NameMetaphone string             `bson:"nameMetaphone,omitempty"`

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

	w(fmt.Sprintf("%d", cu.CustomerID))
	w(cu.City)
	w(fmt.Sprintf("%d", cu.CityCode))
	w(cu.Firstname)
	w(cu.Group)
	w(cu.Name)
	w(cu.Source)
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
