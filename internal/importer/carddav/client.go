package carddav

import (
	"context"
	"fmt"
	"net/http"

	"github.com/emersion/go-webdav"
	"github.com/emersion/go-webdav/carddav"
)

// Client supports basic CardDAV operations.
type Client struct {
	cli *carddav.Client
	cfg *Config
}

// NewClient returns a new CardDAV client.
func NewClient(cfg Config) (*Client, error) {
	var cli webdav.HTTPClient = http.DefaultClient

	if cfg.User != "" {
		cli = webdav.HTTPClientWithBasicAuth(cli, cfg.User, cfg.Password)
	}

	davcli, err := carddav.NewClient(cli, cfg.Server)
	if err != nil {
		return nil, err
	}

	if err := davcli.HasSupport(); err != nil {
		return nil, err
	}

	return &Client{
		cfg: &cfg,
		cli: davcli,
	}, nil
}

func (cli *Client) Sync(ctx context.Context, syncToken string, deleted chan<- string, updated chan<- carddav.AddressObject) (string, error) {
	syncResponse, err := cli.cli.SyncCollection(cli.cfg.AddressBook, &carddav.SyncQuery{
		SyncToken: syncToken,
	})
	if err != nil {
		return "", err
	}

	for _, d := range syncResponse.Deleted {
		deleted <- d
	}

	// either emersion/webdav does not correctly handle AllProps: true in the sync-query
	// or radicale is ingoring it. Nonetheless, we need to fetch all address objects in
	// batches using MultiGet.
	batchSize := 20
	for i := 0; i < len(syncResponse.Updated); i++ {
		paths := make([]string, batchSize)
		for j := 0; j < batchSize; j++ {
			paths[j] = syncResponse.Updated[i+j].Path
		}

		objs, err := cli.cli.MultiGetAddressBook(cli.cfg.AddressBook, &carddav.AddressBookMultiGet{
			Paths: paths,
			DataRequest: carddav.AddressDataRequest{
				AllProp: true,
			},
		})
		if err != nil {
			return "", fmt.Errorf("failed to retreive batch: %w", err)
		}
		for idx := range objs {
			updated <- objs[idx]
		}
	}
	return syncResponse.SyncToken, nil
}

func (cli *Client) ListAddressBooks(ctx context.Context) ([]carddav.AddressBook, error) {
	if err := cli.cli.HasSupport(); err != nil {
		return nil, err
	}

	up, err := cli.cli.FindCurrentUserPrincipal()
	if err != nil {
		return nil, err
	}

	hs, err := cli.cli.FindAddressBookHomeSet(up)
	if err != nil {
		return nil, err
	}

	books, err := cli.cli.FindAddressBooks(hs)
	if err != nil {
		return nil, err
	}

	return books, nil
}
