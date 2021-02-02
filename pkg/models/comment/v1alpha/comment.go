package v1alpha

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Comment struct {
	ID        primitive.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	Key       string             `json:"key" bson:"key,omitempty"`
	ParentID  primitive.ObjectID `json:"parentID,omitempty" bson:"parentID,omitempty"`
	User      string             `json:"user,omitempty" bson:"user,omitempty"`
	Message   string             `json:"message,omitempty" bson:"message,omitempty"`
	CreatedAt time.Time          `json:"createdAt,omitempty" bson:"createdAt,omitempty"`
	UpdatedAt time.Time          `json:"updatedAt,omitempty" bson:"updatedAt,omitempty"`
}
