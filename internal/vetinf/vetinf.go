package vetinf

import (
	"context"
	"fmt"
	"os"

	"github.com/spf13/afero"
	"github.com/tierklinik-dobersberg/cis/internal/database/customerdb"
	"github.com/tierklinik-dobersberg/cis/internal/schema"
	"github.com/tierklinik-dobersberg/cis/internal/textparse"
	"github.com/tierklinik-dobersberg/go-vetinf/vetinf"
	"github.com/tierklinik-dobersberg/logger"
)

// Exporter is capable of exporting and extracting
// data of a VetInf installation.
type Exporter struct {
	cfg schema.VetInf
	db  *vetinf.Infdat
}

// NewExporter creates a new exporter for vetinf.
func NewExporter(cfg schema.VetInf) (*Exporter, error) {
	stat, err := os.Stat(cfg.VetInfDirectory)
	if err != nil {
		return nil, err
	}

	if !stat.IsDir() {
		return nil, fmt.Errorf("%q is not a directory", cfg.VetInfDirectory)
	}

	infdat := vetinf.OpenReadonlyFs(cfg.VetInfDirectory, afero.NewOsFs())

	return &Exporter{
		db:  infdat,
		cfg: cfg,
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
			textparse.PhoneNumber(ctx, customer.CityCode, customer.Phone)

			dbCustomer := &customerdb.Customer{
				CustomerID: customer.ID,
				City:       customer.City,
				CityCode:   customer.CityCode,
				Firstname:  customer.Firstname,
				Group:      customer.Group,
				Name:       customer.Name,
				Phone:      customer.Phone,
				Street:     customer.Street,
				Title:      customer.Titel,
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
