package carddav

import (
	"context"
	"fmt"
	"net/http"

	"github.com/emersion/go-webdav"
	"github.com/emersion/go-webdav/carddav"
	"github.com/tierklinik-dobersberg/cis/internal/cfgspec"
	"github.com/tierklinik-dobersberg/logger"
)

// Client supports basic CardDAV operations.
type Client struct {
	cli *carddav.Client
	cfg *cfgspec.CardDAVConfig
}

// NewClient returns a new CardDAV client.
func NewClient(cfg *cfgspec.CardDAVConfig) (*Client, error) {
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
		cfg: cfg,
		cli: davcli,
	}, nil
}

func (cli *Client) Sync(ctx context.Context, col, syncToken string, deleted chan<- string, updated chan<- carddav.AddressObject) (string, error) {
	syncResponse, err := cli.cli.SyncCollection(col, &carddav.SyncQuery{
		SyncToken: syncToken,
	})
	if err != nil {
		return "", err
	}
	logger.From(ctx).Infof("carddav: received sync response with %d deletes and %d updates", len(syncResponse.Deleted), len(syncResponse.Updated))

	for _, d := range syncResponse.Deleted {
		select {
		case deleted <- d:
		case <-ctx.Done():
			return "", ctx.Err()
		}
	}

	// either emersion/webdav does not correctly handle AllProps: true in the sync-query
	// or radicale is ingoring it. Nonetheless, we need to fetch all address objects in
	// batches using MultiGet.
	batchSize := 20
	for i := 0; i < len(syncResponse.Updated); i += batchSize {
		paths := make([]string, 0, batchSize)
		for j := 0; j < batchSize && (i+j) < len(syncResponse.Updated); j++ {
			paths = append(paths, syncResponse.Updated[i+j].Path)
		}

		objs, err := cli.cli.MultiGetAddressBook(col, &carddav.AddressBookMultiGet{
			Paths: paths,
			DataRequest: carddav.AddressDataRequest{
				AllProp: true,
			},
		})
		if err != nil {
			return "", fmt.Errorf("failed to retreive batch: %w", err)
		}
		for idx := range objs {
			select {
			case updated <- objs[idx]:
			case <-ctx.Done():
				return "", ctx.Err()
			}
		}
	}
	return syncResponse.SyncToken, nil
}

func (cli *Client) DeleteObject(ctx context.Context, path string) error {
	if err := cli.cli.RemoveAll(path); err != nil {
		return err
	}
	return nil
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
