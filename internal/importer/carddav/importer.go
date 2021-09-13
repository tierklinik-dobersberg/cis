package carddav

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/emersion/go-vcard"
	"github.com/emersion/go-webdav/carddav"
	"github.com/nyaruka/phonenumbers"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/cfgspec"
	"github.com/tierklinik-dobersberg/cis/internal/database/customerdb"
	"github.com/tierklinik-dobersberg/cis/internal/importer"
	"github.com/tierklinik-dobersberg/cis/pkg/cache"
	"github.com/tierklinik-dobersberg/logger"
	"go.mongodb.org/mongo-driver/bson"
)

func init() {
	importer.Register(importer.Factory{
		Name: "carddav",
		Setup: func(app *app.App) ([]*importer.Instance, error) {
			var instances []*importer.Instance

			for _, cfg := range app.Config.CardDAVImports {
				importer, err := getImporter(app, cfg)
				if err != nil {
					return nil, err
				}
				instances = append(instances, importer)
			}

			return instances, nil
		},
	})
}

func getImporter(app *app.App, cfg cfgspec.CardDAVConfig) (*importer.Instance, error) {
	cli, err := NewClient(cfg)
	if err != nil {
		return nil, err
	}

	id := fmt.Sprintf("carddav-%s", cfg.ID)
	i := &importer.Instance{
		ID:             id,
		Schedule:       cfg.Schedule,
		RunImmediately: true,
		Handler: importer.ImportFunc(func() (interface{}, error) {
			ctx := context.Background()

			// determine the addressbook to use and update cfg.AddressBook so this
			// importer instance always uses the same addressbook.
			if cfg.AddressBook == "" {
				logger.From(ctx).Errorf("%s: no address book configured. Trying to auto-detect the default addressbook", id)

				books, err := cli.ListAddressBooks(ctx)
				if err != nil {
					return nil, fmt.Errorf("failed to enumerate address books: %w", err)
				}
				if len(books) == 0 {
					return nil, fmt.Errorf("no address books available")
				}
				// try to find an address book with the name "default"
				for _, b := range books {
					if strings.ToLower(b.Name) == "default" {
						logger.From(ctx).Infof("%s: using address book %s (%s)", id, b.Name, b.Path)
						cfg.AddressBook = b.Path
						break
					}
				}
				if cfg.AddressBook == "" {
					b := books[0]
					logger.From(ctx).Infof("%s: using address book %s (%s)", id, b.Name, b.Path)
					cfg.AddressBook = b.Path
				}
			}

			cacheKey := fmt.Sprintf("persist/carddav/%s/syncToken", cfg.ID)
			syncToken, _, err := app.Cache.Read(ctx, cacheKey)
			if err != nil && !errors.Is(err, cache.ErrNotFound) {
				return nil, fmt.Errorf("failed to retrieve sync-token: %w", err)
			}

			var (
				wg        sync.WaitGroup
				nextToken string
				deleted   = make(chan string)
				updated   = make(chan carddav.AddressObject)
			)

			wg.Add(1)
			go func() {
				defer close(deleted)
				defer close(updated)
				defer wg.Done()

				nextToken, err = cli.Sync(ctx, cfg.AddressBook, string(syncToken), deleted, updated)
			}()

			ticker := time.NewTicker(10 * time.Second)
			defer func() {
				ticker.Stop()
				select {
				case <-ticker.C:
				default:
				}
			}()

			countFailedDelete := 0
			countFailedUpdate := 0
			countDeleted := 0
			countUpdated := 0
			countNew := 0
		L:
			for {
				select {
				case d, ok := <-deleted:
					if !ok {
						deleted = nil
					} else {
						if err := handleDelete(ctx, app, d); err != nil {
							countFailedDelete++
							logger.From(ctx).Errorf("%s: failed to delete carddav contact %q: %s", id, d, err)
						} else {
							countDeleted++
						}
					}

				case upd, ok := <-updated:
					if !ok {
						break L
					}
					if isNew, err := handleUpdate(ctx, app, upd); err != nil {
						countFailedUpdate++
						logger.From(ctx).Errorf("%s: failed to handle carddav contact update %q: %s", id, upd.Path, err)
					} else {
						if isNew {
							countNew++
						} else {
							countUpdated++
						}
					}

				case <-ticker.C:
					logger.From(ctx).WithFields(logger.Fields{
						"deleted": countDeleted,
						"updated": countUpdated,
						"new":     countNew,
						"failed":  countFailedDelete + countFailedUpdate,
					}).Infof("%s: import in progress", id)

				case <-ctx.Done():
					return nil, ctx.Err()
				}
			}

			// wait for the goroutine to exit and populate nextToken and err
			wg.Wait()
			if err != nil {
				return nil, err
			}
			if err := app.Cache.Write(ctx, cacheKey, []byte(nextToken)); err != nil {
				return nil, fmt.Errorf("failed to persist sync-token: %w", err)
			}

			return nil, err
		}),
	}

	return i, nil
}

func handleDelete(ctx context.Context, app *app.App, path string) error {
	cus, err := findByPath(ctx, app, path)
	if err != nil {
		return err
	}
	if cus == nil {
		// customer does not exist
		return nil
	}
	if err := app.Customers.DeleteCustomer(ctx, cus.ID.Hex()); err != nil {
		return fmt.Errorf("failed to delete customer %s: %w", cus.ID, err)
	}
	return nil
}

func handleUpdate(ctx context.Context, app *app.App, ao carddav.AddressObject) (bool, error) {
	if ao.Card == nil {
		return false, fmt.Errorf("no VCARD data available")
	}

	cus, err := findByPath(ctx, app, ao.Path)
	if err != nil {
		return false, err
	}

	if cus == nil {
		// Create a new customer record
		cus = &customerdb.Customer{
			CustomerID: getID(ao.Path),
			Source:     "carddav",
		}
	}

	if n := ao.Card.Name(); n != nil {
		cus.Firstname = n.GivenName
		cus.Name = n.FamilyName
		cus.Title = n.HonorificPrefix
	}

	if addr := ao.Card.Address(); addr != nil {
		cus.Street = addr.StreetAddress
		cus.City = addr.Locality
		if pos, err := strconv.ParseInt(addr.PostalCode, 10, 0); err == nil {
			cus.CityCode = int(pos)
		} else {
			logger.From(ctx).Errorf("failed to parse postal code %q", addr.PostalCode)
		}
	}

	cus.MailAddresses = ao.Card.Values(vcard.FieldEmail)
	for _, phone := range ao.Card.Values(vcard.FieldTelephone) {
		number, err := phonenumbers.Parse(phone, app.Config.Country)
		if err != nil {
			logger.From(ctx).Errorf("failed to parse phone number %q: %s", phone, err)
			continue
		}
		cus.PhoneNumbers = append(cus.PhoneNumbers,
			phonenumbers.Format(number, phonenumbers.INTERNATIONAL),
			phonenumbers.Format(number, phonenumbers.NATIONAL),
		)
	}

	cus.Metadata = map[string]interface{}{
		"path": ao.Path,
		"uid":  ao.Card.Value(vcard.FieldUID),
		"url":  ao.Card.Value(vcard.FieldURL),
		"rev":  ao.Card.Value(vcard.FieldRevision),
	}

	isNew := cus.ID.IsZero()
	if isNew {
		if err := app.Customers.CreateCustomer(ctx, cus); err != nil {
			return isNew, fmt.Errorf("failed to create customer: %w", err)
		}
	} else {
		if err := app.Customers.UpdateCustomer(ctx, cus); err != nil {
			return isNew, fmt.Errorf("failed to update customer %s: %s", cus.ID, err)
		}
	}

	return isNew, nil
}

func findByPath(ctx context.Context, app *app.App, path string) (*customerdb.Customer, error) {
	customers, err := app.Customers.FilterCustomer(ctx, bson.M{
		"source":                "carddav",
		"metadata.carddav.path": path,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to find customer by path %s: %s", path, err)
	}
	if len(customers) == 0 {
		return nil, nil
	}
	if len(customers) > 1 {
		return nil, fmt.Errorf("multiple customers matched %s", path)
	}
	return customers[0], nil
}

func getID(path string) string {
	s := sha256.New()
	_, _ = s.Write([]byte(path))
	return hex.EncodeToString(s.Sum(nil))[:16]
}
