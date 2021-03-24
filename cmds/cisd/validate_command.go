package main

import (
	"log"

	"github.com/spf13/cobra"
	"github.com/tierklinik-dobersberg/cis/internal/autodoc"
)

func getValidateCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use: "validate",
		// TODO(ppacher): try to load all configuration files
		// here if one are specified.
		Args: cobra.MinimumNArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			for _, file := range args {
				f, ok := autodoc.DefaultRegistry.DocsFor(file)
				if !ok {
					log.Printf("%s: unknown configuration file", file)
					continue
				}

				// TODO(ppacher): correctly handle drop-in file paths
				// here
				if _, err := f.LoadFile(file, nil); err != nil {
					log.Printf("%s (type: %s): %s", file, f.Name, err)
					continue
				}
			}
		},
	}
	return cmd
}
