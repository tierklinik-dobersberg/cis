//nolint:forbidigo
package main

import (
	"fmt"
	"log"

	"github.com/emersion/go-webdav/carddav"
	"github.com/spf13/cobra"
)

func getListCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use: "list",
		Run: func(cmd *cobra.Command, args []string) {
			listAll()
		},
	}

	return cmd
}

func listAll() {
	cli := getClient()
	up, err := cli.FindCurrentUserPrincipal()
	if err != nil {
		log.Fatal(err.Error())
	}

	hs, err := cli.FindAddressBookHomeSet(up)
	if err != nil {
		log.Fatal(err.Error())
	}

	fmt.Printf("user principal: %s\nhome addressbook set: %s\n", up, hs)

	books, err := cli.FindAddressBooks(hs)
	if err != nil {
		log.Fatal(err.Error())
	}

	for _, book := range books {
		fmt.Printf("%s - %s (at %s)\n", book.Name, book.Description, book.Path)
		objs, err := cli.QueryAddressBook(book.Path, &carddav.AddressBookQuery{
			DataRequest: carddav.AddressDataRequest{
				AllProp: true,
			},
		})
		if err != nil {
			log.Printf("failed to query %s: %s", book.Path, err)
			continue
		}

		fmt.Printf("=> %s: %d objects found\n", book.Path, len(objs))
		printObjects(objs)
	}
}
