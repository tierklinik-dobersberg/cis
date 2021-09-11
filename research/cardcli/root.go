package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/emersion/go-webdav"
	"github.com/emersion/go-webdav/carddav"
	"github.com/spf13/cobra"
	"golang.org/x/crypto/ssh/terminal"
)

var cfg = struct {
	server   string
	username string
	password string
	columns  []string
	format   string
}{}

func getRootCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "cardcli",
		Short: "Research experiment for go-webdav and radicale integration",
	}

	cmd.AddCommand(
		getListCmd(),
		getFindCommand(),
		getSyncCommand(),
	)

	f := cmd.PersistentFlags()
	{
		f.StringVarP(&cfg.server, "server", "s", "", "The address of the CardDAV server")
		f.StringVarP(&cfg.username, "user", "u", "", "The username for the CardDAV server")
		f.StringVarP(&cfg.password, "pass", "p", "", "The password for the CardDAV server. If set to -, the password will be prompted")
		f.StringSliceVarP(&cfg.columns, "fields", "F", defaultFields, "Which columns to print")
		f.StringVarP(&cfg.format, "format", "f", "table", "Configures the output format. Valid values are table and vcard")
	}

	return cmd
}

func getFirstBook() string {
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
	if len(books) == 0 {
		log.Fatalf("no addressbooks defined for %s", up)
	}

	return books[0].Path
}

func getClient() *carddav.Client {
	var cli webdav.HTTPClient = http.DefaultClient
	if cfg.username != "" {
		cli = webdav.HTTPClientWithBasicAuth(cli, cfg.username, getPassword())
	}

	cardcli, err := carddav.NewClient(cli, cfg.server)
	if err != nil {
		log.Fatal(err.Error())
	}
	return cardcli
}

func getPassword() string {
	if cfg.password == "-" {
		fmt.Print("Password: ")
		pwd, err := terminal.ReadPassword(int(os.Stdin.Fd()))
		if err != nil {
			log.Fatal(err.Error())
		}
		return string(pwd)
	}
	return cfg.password
}
