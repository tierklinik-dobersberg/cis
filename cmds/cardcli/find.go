package main

import (
	"fmt"
	"log"

	"github.com/emersion/go-vcard"
	"github.com/emersion/go-webdav/carddav"
	"github.com/spf13/cobra"
)

func getFindCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use: "find",
	}

	filters := []struct {
		name string
		prop string
	}{
		{"phone", vcard.FieldTelephone},
		{"name", vcard.FieldName},
	}

	for idx := range filters {
		f := filters[idx]
		subcmd := &cobra.Command{
			Use:  f.name,
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
					Name:        f.prop,
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
	for _, r := range res {
		name := getName(r.Card)
		fmt.Printf("%s - %s\n", name, r.Card.Value(vcard.FieldTelephone))
	}
}
