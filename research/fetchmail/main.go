package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"time"

	"github.com/mxk/go-imap/imap"
	"github.com/spf13/cobra"
	"github.com/tierklinik-dobersberg/mailbox"
)

func main() {
	var info mailbox.Config
	var fetchFrom uint32
	var findMIME string

	cmd := &cobra.Command{
		Use:  "fetchmail",
		Args: cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			client, err := mailbox.Connect(info)
			if err != nil {
				log.Fatal(err)
			}
			defer client.IMAP.Close(true)

			log.Printf("UIDVALIDITY=%d", client.IMAP.Mailbox.UIDValidity)

			uids, err := client.SearchUIDs(args[0], time.Time{})
			if err != nil {
				log.Fatal(err)
			}

			seqset := new(imap.SeqSet)
			if fetchFrom == 0 {
				for _, uid := range uids {
					seqset.AddNum(uid)
				}
			} else {
				seqset.AddRange(fetchFrom, 0)
			}

			enc := json.NewEncoder(os.Stdout)
			enc.SetEscapeHTML(false)
			enc.SetIndent("", "  ")

			ctx := context.Background()
			mails, err := client.FetchUIDs(ctx, seqset)
			if err != nil {
				log.Fatal(err)
			}

			for mail := range mails {
				if findMIME == "" {
					if err := enc.Encode(mail); err != nil {
						log.Fatal(err)
					}
					continue
				}

				parts := mail.FindByMIME(findMIME)
				if len(parts) > 0 {
					if err := enc.Encode(map[string]interface{}{
						"subject": mail.Subject,
						"to":      mail.To,
						"from":    mail.From,
						findMIME:  parts,
					}); err != nil {
						log.Fatal(err)
					}
				}
			}
		},
	}

	flags := cmd.Flags()
	{
		flags.StringVarP(&info.Host, "server", "s", "", "IMAP server address")
		flags.BoolVar(&info.TLS, "tls", true, "Enable or disable TLS")
		flags.BoolVar(&info.InsecureSkipVerify, "insecure", false, "Disable TLS certificate validation")
		flags.StringVarP(&info.User, "user", "u", "", "The username")
		flags.StringVarP(&info.Password, "password", "p", "", "The password")
		flags.StringVarP(&info.Folder, "folder", "f", "", "The mailbox folder")
		flags.BoolVar(&info.ReadOnly, "read-only", false, "Read-only mode")
		flags.Uint32Var(&fetchFrom, "fetch-from", 0, "The first UID to fetch")
		flags.StringVar(&findMIME, "by-mime", "", "Print attachments that match MIME")
	}

	if err := cmd.Execute(); err != nil {
		log.Fatal(err)
	}
}
