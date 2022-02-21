package main

import (
	"log"

	"github.com/charmbracelet/glamour"
)

var Render func(string) string

func init() {
	termRenderer, err := glamour.NewTermRenderer(
		// detect background color and pick either the default dark or light theme
		glamour.WithAutoStyle(),
	)
	if err != nil {
		log.Println(err.Error())
	}

	Render = func(input string) string {
		if termRenderer == nil {
			return input
		}

		res, err := termRenderer.Render(input)
		if err != nil {
			log.Println(err)

			return input
		}

		return res
	}
}
