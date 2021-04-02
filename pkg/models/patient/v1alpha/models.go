package v1alpha

import "go.mongodb.org/mongo-driver/bson/primitive"

type PatientRecord struct {
	ID             primitive.ObjectID `json:"_id" bson:"_id,omitempty"`
	CustomerSource string             `json:"customerSource" bson:"customerSource,omitempty"`
	CustomerID     int                `json:"customerID" bson:"customerID,omitempty"`
	Size           string             `json:"size" bson:"size,omitempty"`
	Species        string             `json:"species" bson:"species,omitempty"`
	Breed          string             `json:"breed" bson:"breed,omitempty"`
	Gender         string             `json:"gender" bson:"gender,omitempty"`
	Name           string             `json:"name" bson:"name,omitempty"`
	Birthday       string             `json:"birthday" bson:"birthday,omitempty"`
	SpecialDetail  string             `json:"specialDetail" bson:"specialDetail,omitempty"`
	AnimalID       string             `json:"animalID" bson:"animalID,omitempty"`
	Color          string             `json:"color" bson:"color,omitempty"`
	ChipNumber     string             `json:"chipNumber" bson:"chipNumber,omitempty"`
	Notes          []string           `json:"notes" bson:"notes,omitempty"`
}
