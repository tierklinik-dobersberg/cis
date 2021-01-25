package neumayr

import (
	"context"
	"errors"
	"fmt"
	"os"

	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/database/customerdb"
	"github.com/tierklinik-dobersberg/logger"
)

type Importer struct {
	app *app.App
}

func NewImporter(app *app.App) *Importer {
	return &Importer{
		app: app,
	}
}

func (imp *Importer) Import(ctx context.Context, mdb *os.File) (countNew, countUpdated, countUnchanged int, err error) {
	converter, err := NewConverter(imp.app.Config.Country)
	if err != nil {
		return 0, 0, 0, err
	}

	customers, err := converter.Convert(ctx, mdb)
	if err != nil {
		return 0, 0, 0, fmt.Errorf("failed to convert: %w", err)
	}

	for _, customer := range customers {
		existing, err := imp.app.Customers.CustomerByCID(ctx, "neumayr", customer.CustomerID)
		if errors.Is(err, customerdb.ErrNotFound) {
			err = imp.app.Customers.CreateCustomer(ctx, &customer)
			if err == nil {
				countNew++
			}
		} else if existing != nil && existing.Hash() != customer.Hash() {
			customer.ID = existing.ID
			err = imp.app.Customers.UpdateCustomer(ctx, &customer)
			if err == nil {
				countUpdated++
			}
		} else if existing != nil {
			countUnchanged++
		}

		if err != nil {
			logger.Errorf(ctx, "failed to import customer %s: %s", customer.CustomerID, err)
		}
	}

	logger.From(ctx).WithFields(logger.Fields{
		"new":       countNew,
		"updated":   countUpdated,
		"unchanged": countUnchanged,
	}).Infof("import finished")

	return
}
