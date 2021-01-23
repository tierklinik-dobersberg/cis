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
}

// Hash returns a hash of the customer
func (cu *Customer) Hash() string {
	h := sha1.New()
	h.Write([]byte(fmt.Sprintf("%d", cu.CustomerID)))
	h.Write([]byte(cu.City))
	h.Write([]byte(fmt.Sprintf("%d", cu.CityCode)))
	h.Write([]byte(cu.Firstname))
	h.Write([]byte(cu.Group))
	h.Write([]byte(cu.Name))
	for _, p := range cu.PhoneNumbers {
		h.Write([]byte(p))
	}
	for _, m := range cu.MailAddresses {
		h.Write([]byte(m))
	}
	h.Write([]byte(cu.Street))
	h.Write([]byte(cu.Title))

	return hex.EncodeToString(h.Sum(nil))
}
