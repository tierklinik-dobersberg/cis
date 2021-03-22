package main

import (
	"fmt"
	"log"

	"github.com/charmbracelet/glamour"
	"github.com/spf13/cobra"
	"github.com/tierklinik-dobersberg/cis/internal/autodoc"
	_ "github.com/tierklinik-dobersberg/cis/internal/autodoc/renderers"
)

func getManCommand() *cobra.Command {
	return &cobra.Command{
		Use: "man",
		Run: func(_ *cobra.Command, args []string) {
			r, err := glamour.NewTermRenderer(
				// detect background color and pick either the default dark or light theme
				glamour.WithAutoStyle(),
			)
			if err != nil {
				log.Fatalf(err.Error())
			}

			if len(args) == 0 {
				fmt.Printf("The following configuration files are supported:\n\n")
				for _, file := range autodoc.DefaultRegistry.List() {
					fmt.Printf(" - %s\n", file.Name)
				}
				return
			}

			for _, file := range args {
				f, ok := autodoc.DefaultRegistry.DocsFor(file)
				if !ok {
					log.Fatalf("unknown configuration file %s", file)
				}

				str, err := autodoc.DefaultRegistry.Render("markdown", f)
				if err != nil {
					log.Fatalf("failed to render %s: %s", file, err)
				}

				result, err := r.Render(str)
				if err != nil {
					log.Printf("failed to render markdown: %s", err.Error())
					fmt.Println(str)
				} else {
					fmt.Println(result)
				}
			}
		},
	}
}
