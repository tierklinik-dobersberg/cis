package vetinf

import (
	"context"
	"fmt"
	"os"

	"github.com/nyaruka/phonenumbers"
	"github.com/spf13/afero"
	"github.com/tierklinik-dobersberg/cis/internal/database/customerdb"
	"github.com/tierklinik-dobersberg/cis/internal/schema"
	"github.com/tierklinik-dobersberg/go-vetinf/vetinf"
	"github.com/tierklinik-dobersberg/logger"
)

// Exporter is capable of exporting and extracting
// data of a VetInf installation.
type Exporter struct {
	cfg     schema.VetInf
	db      *vetinf.Infdat
	country string
}

// NewExporter creates a new exporter for vetinf.
func NewExporter(cfg schema.VetInf, country string) (*Exporter, error) {
	stat, err := os.Stat(cfg.VetInfDirectory)
	if err != nil {
		return nil, err
	}

	if !stat.IsDir() {
		return nil, fmt.Errorf("%q is not a directory", cfg.VetInfDirectory)
	}

	infdat := vetinf.OpenReadonlyFs(cfg.VetInfDirectory, afero.NewOsFs())

	return &Exporter{
		db:      infdat,
		cfg:     cfg,
		country: country,
	}, nil
}

// ExportCustomers exports all vetinf customers and streams them to
// the returned channel. Errors encountered when exporting single
// customers are logged and ignored.
func (e *Exporter) ExportCustomers(ctx context.Context) (<-chan *customerdb.Customer, int, error) {
	log := logger.From(ctx)

	customerDB, err := e.db.CustomerDB(e.cfg.VetInfEncoding)
	if err != nil {
		return nil, 0, err
	}

	dataCh, errCh, total := customerDB.StreamAll(ctx)

	customers := make(chan *customerdb.Customer, 10)

	go func() {
		for err := range errCh {
			log.Errorf("export: %s", err)
		}
	}()

	go func() {
		defer close(customers)
		for customer := range dataCh {
			//textparse.PhoneNumber(ctx, customer.Phone)

			dbCustomer := &customerdb.Customer{
				CustomerID: customer.ID,
				City:       customer.City,
				CityCode:   customer.CityCode,
				Firstname:  customer.Firstname,
				Group:      customer.Group,
				Name:       customer.Name,
				Street:     customer.Street,
				Title:      customer.Titel,
				Source:     "vetinf",
				Metadata: map[string]interface{}{
					"rawVetInfRecord": customer,
				},
			}

			key := fmt.Sprintf("[%s %s <cid:%d>]", dbCustomer.Name, dbCustomer.Firstname, dbCustomer.CustomerID)

			var hasInvalidPhone bool

			// Add all possible phPropertiesone numbers
			if customer.Phone != "" {
				dbCustomer.PhoneNumbers = addNumber(key, dbCustomer.PhoneNumbers, customer.Phone, e.country, &hasInvalidPhone)
			}
			if customer.Phone2 != "" {
				dbCustomer.PhoneNumbers = addNumber(key, dbCustomer.PhoneNumbers, customer.Phone2, e.country, &hasInvalidPhone)
			}
			if customer.MobilePhone1 != "" {
				dbCustomer.PhoneNumbers = addNumber(key, dbCustomer.PhoneNumbers, customer.MobilePhone1, e.country, &hasInvalidPhone)
			}
			if customer.MobilePhone2 != "" {
				dbCustomer.PhoneNumbers = addNumber(key, dbCustomer.PhoneNumbers, customer.MobilePhone2, e.country, &hasInvalidPhone)
			}

			// add all possible mail addresses
			if customer.Mail != "" {
				dbCustomer.MailAddresses = append(dbCustomer.MailAddresses, customer.Mail)
			}

			if hasInvalidPhone {
				logger.Infof(ctx, "customer %s has invalid phone numer", key)
				dbCustomer.Metadata["vetinfInvalidPhone"] = true
			}

			select {
			case customers <- dbCustomer:
			case <-ctx.Done():
				return
			}
		}
	}()

	return customers, total, nil
}

func addNumber(id string, numbers []string, number, country string, hasError *bool) []string {
	p, err := phonenumbers.Parse(number, country)
	if err != nil {
		*hasError = true
		logger.DefaultLogger().Errorf("%s failed to parse phone number: %q in country %s: %s", id, number, country, err)
		return numbers
	}

	return append(numbers, []string{
		phonenumbers.Format(p, phonenumbers.NATIONAL),
		phonenumbers.Format(p, phonenumbers.INTERNATIONAL),
	}...)
}
