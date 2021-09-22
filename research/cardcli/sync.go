package main

import (
	"fmt"
	"log"

	"github.com/emersion/go-webdav/carddav"
	"github.com/schollz/progressbar/v3"
	"github.com/spf13/cobra"
)

func getSyncCommand() *cobra.Command {
	var (
		collection string
		syncToken  string
		limit      int
	)
	cmd := &cobra.Command{
		Use:   "sync",
		Short: "Initiate a collection sync",
		Run: func(cmd *cobra.Command, args []string) {
			cli := getClient()

			res, err := cli.SyncCollection(collection, &carddav.SyncQuery{
				DataRequest: carddav.AddressDataRequest{
					AllProp: true,
				},
				Limit:     limit,
				SyncToken: syncToken,
			})
			if err != nil {
				log.Fatal(err)
			}

			fmt.Printf("Sync-Token: %s\n", res.SyncToken)
			fmt.Printf("Deleted: %d\n", len(res.Deleted))
			fmt.Printf("Updated: %d\n", len(res.Updated))
			fmt.Println("------------------------------------")

			bar := progressbar.Default(int64(len(res.Updated)))

			batchSize := 20
			var all []carddav.AddressObject
			for i := 0; i < len(res.Updated); i += batchSize {
				paths := make([]string, batchSize)
				for idx := 0; idx < batchSize && idx+i < len(res.Updated); idx++ {
					paths[idx] = res.Updated[i+idx].Path
				}
				mg, err := cli.MultiGetAddressBook(collection, &carddav.AddressBookMultiGet{
					Paths: paths,
					DataRequest: carddav.AddressDataRequest{
						AllProp: true,
					},
				})
				_ = bar.Add(batchSize)
				if err != nil {
					log.Fatal(err)
				}
				all = append(all, mg...)
			}
			printObjects(all)
		},
	}

	f := cmd.Flags()
	{
		f.StringVar(&collection, "collection", "", "The path of the collection to sync")
		f.StringVar(&syncToken, "sync-token", "", "The sync token")
		f.IntVar(&limit, "limit", 0, "The limit to use")

		_ = cmd.MarkFlagRequired("collection")
	}

	return cmd
}
