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
	_, _ = h.Write([]byte(fmt.Sprintf("%d", cu.CustomerID)))
	_, _ = h.Write([]byte(cu.City))
	_, _ = h.Write([]byte(fmt.Sprintf("%d", cu.CityCode)))
	_, _ = h.Write([]byte(cu.Firstname))
	_, _ = h.Write([]byte(cu.Group))
	_, _ = h.Write([]byte(cu.Name))
	_, _ = h.Write([]byte(cu.Source))
	for _, p := range cu.PhoneNumbers {
		_, _ = h.Write([]byte(p))
	}
	for _, m := range cu.MailAddresses {
		_, _ = h.Write([]byte(m))
	}
	_, _ = h.Write([]byte(cu.Street))
	_, _ = h.Write([]byte(cu.Title))

	return hex.EncodeToString(h.Sum(nil))
}
