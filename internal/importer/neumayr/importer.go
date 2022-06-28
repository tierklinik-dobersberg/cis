package neumayr

import (
	"context"
	"errors"
	"fmt"
	"os"

	"github.com/tierklinik-dobersberg/cis/internal/database/customerdb"
	"github.com/tierklinik-dobersberg/cis/internal/importer/importutils"
	"github.com/tierklinik-dobersberg/cis/runtime"
	"github.com/tierklinik-dobersberg/logger"
)

type Importer struct {
	customers customerdb.Database
	country   string
}

func NewImporter(country string, customers customerdb.Database) *Importer {
	return &Importer{
		customers: customers,
		country:   country,
	}
}

func (imp *Importer) Import(ctx context.Context, mdb *os.File) (countNew, countUpdated, countUnchanged int, err error) {
	log := log.From(ctx)
	converter, err := NewConverter(imp.country)
	if err != nil {
		return 0, 0, 0, err
	}

	customers, err := converter.Convert(ctx, mdb)
	if err != nil {
		return 0, 0, 0, fmt.Errorf("failed to convert: %w", err)
	}

	for idx := range customers {
		customer := customers[idx]

		existing, err := imp.customers.CustomerByCID(ctx, "neumayr", customer.CustomerID)

		switch {
		case errors.Is(err, customerdb.ErrNotFound):
			err = imp.customers.CreateCustomer(ctx, &customer)
			if err == nil {
				countNew++
			}
		case existing != nil && existing.Hash() != customer.Hash():
			importutils.CopyCustomerAttributes(existing, &customer)

			err = imp.customers.UpdateCustomer(ctx, &customer)
			if err == nil {
				countUpdated++
			}
		case existing != nil:
			countUnchanged++
		}

		if err != nil {
			log.Errorf("failed to import customer %s: %s", customer.CustomerID, err)
		}
	}

	log.WithFields(logger.Fields{
		"new":       countNew,
		"updated":   countUpdated,
		"unchanged": countUnchanged,
	}).Infof("import finished")

	return
}

func init() {
	runtime.Must(
		customerdb.DefaultSourceManager.Register(customerdb.Source{
			Name:        "neumayr",
			Description: "Imports customer data from Neumayr .MDB files",
		}),
	)
}
