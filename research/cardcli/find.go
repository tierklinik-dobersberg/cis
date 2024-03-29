//nolint:forbidigo
package main

import (
	"fmt"
	"log"

	"github.com/emersion/go-webdav/carddav"
	"github.com/spf13/cobra"
)

func getFindCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use: "find",
	}

	for p, n := range fieldToName {
		prop := p
		name := n
		subcmd := &cobra.Command{
			Use:  name,
			Args: cobra.MinimumNArgs(1),
			Run: func(cmd *cobra.Command, args []string) {
				filter := []carddav.TextMatch{}

				for _, arg := range args {
					filter = append(filter, carddav.TextMatch{
						Text:      arg,
						MatchType: carddav.MatchContains,
					})
				}
				find("", carddav.PropFilter{
					Test:        carddav.FilterAnyOf,
					TextMatches: filter,
					Name:        prop,
				})
			},
		}

		cmd.AddCommand(subcmd)
	}

	return cmd
}

func find(book string, filter carddav.PropFilter) {
	if book == "" {
		book = getFirstBook()
	}

	cli := getClient()

	res, err := cli.QueryAddressBook(book, &carddav.AddressBookQuery{
		DataRequest: carddav.AddressDataRequest{
			AllProp: true,
		},
		PropFilters: []carddav.PropFilter{filter},
	})
	if err != nil {
		log.Fatal(err.Error())
	}

	fmt.Printf("found %d results\n", len(res))
	printObjects(res)
}
