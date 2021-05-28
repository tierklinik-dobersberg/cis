package main

import (
	"fmt"
	"log"

	"github.com/spf13/cobra"
	"github.com/tierklinik-dobersberg/cis/pkg/autodoc"
	_ "github.com/tierklinik-dobersberg/cis/pkg/autodoc/renderers"
)

func getManCommand() *cobra.Command {
	return &cobra.Command{
		Use: "man",
		Run: func(_ *cobra.Command, args []string) {
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

				fmt.Println(Render(str))
			}
		},
	}
}
