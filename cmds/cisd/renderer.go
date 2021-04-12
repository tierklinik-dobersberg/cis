package main

import (
	"log"

	"github.com/charmbracelet/glamour"
)

var Render func(string) string

func init() {
	r, err := glamour.NewTermRenderer(
		// detect background color and pick either the default dark or light theme
		glamour.WithAutoStyle(),
	)
	if err != nil {
		log.Println(err.Error())
	}

	Render = func(s string) string {
		if r == nil {
			return s
		}
		res, err := r.Render(s)
		if err != nil {
			log.Println(err)
			return s
		}
		return res
	}
}
