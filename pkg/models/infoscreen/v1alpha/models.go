package v1alpha

import (
	"time"

	"github.com/tierklinik-dobersberg/cis/internal/infoscreen/layouts"
)

type Slide struct {
	Layout      string        `bson:"layout,omitempty" json:"layout"`
	Duration    time.Duration `bson:"duration,omitempty" json:"duration,omitempty"`
	Vars        layouts.Vars  `bson:"vars,omitempty" json:"vars,omitempty"`
	AutoAnimate string        `bson:"autoAnimate,omitempty" json:"autoAnimate,omitempty"`
	Background  string        `bson:"background,omitempty" json:"background,omitempty"`
}

type Auth struct {
	Type  string `bson:"type,omitempty" json:"type,omitempty"`
	Token string `bson:"token,omitempty" json:"token,omitempty"`
}

type Show struct {
	Name        string  `bson:"name,omitempty" json:"name,omitempty"`
	Description string  `bson:"description,omitempty" json:"description,omitempty"`
	Slides      []Slide `bson:"slides,omitempty" json:"slides,omitempty"`
	Auth        Auth    `bson:"auth,omitempty" json:"auth,omitempty"`
}

type ListShowEntry struct {
	Name           string `json:"name"`
	Description    string `json:"description,omitempty"`
	NumberOfSlides int    `json:"numberOfSlides"`
}

type ListShowsResponse struct {
	Shows []ListShowEntry `json:"shows"`
}
