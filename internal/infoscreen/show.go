package infoscreen

import "time"

type Meta struct {
	Name   string      `hcl:"name,label"`
	Value  interface{} `hcl:"value"`
	Markup string      `hcl:"markup"`
}

type Slide struct {
	Layout   string        `hcl:"layout,label"`
	Duration time.Duration `hcl:"duration"`
	Meta     []Meta        `hcl:"meta,block"`
}

type Auth struct {
	Type  string `hcl:"type"`
	Token string `hcl:"token"`
}

type Show struct {
	Name   string  `hcl:"name,label"`
	Slides []Slide `hcl:"slide,block"`
	Auth   Auth    `hcl:"auth,block"`
}
