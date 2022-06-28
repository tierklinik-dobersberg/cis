package vetinf

import (
	"context"
	"errors"

	"github.com/tierklinik-dobersberg/cis/internal/database/customerdb"
	"github.com/tierklinik-dobersberg/cis/internal/importer"
	"github.com/tierklinik-dobersberg/cis/internal/importer/importutils"
	"github.com/tierklinik-dobersberg/logger"
)

func getCustomerImporter(cfg VetInf, customers customerdb.Database, exporter *Exporter) (*importer.Instance, error) {
	i := &importer.Instance{
		ID:       "vetinf-customer:" + convertToID(cfg.Directory),
		Schedule: cfg.ImportSchedule,
		Handler: importer.ImportFunc(func(ctx context.Context) (interface{}, error) {
			return ImportCustomers(ctx, exporter, customers)
		}),
	}

	// TODO(ppacher): get source manager as a parameter.
	if err := customerdb.DefaultSourceManager.Register(customerdb.Source{
		Name:        "vetinf",
		Description: "Imports customer data from a VetInf installation",
		Metadata: map[string]interface{}{
			"Path": exporter.cfg.Directory,
		},
	}); err != nil {
		return nil, err
	}

	return i, nil
}

func ImportCustomers(ctx context.Context, exporter *Exporter, customers customerdb.Database) (*ImportResults, error) {
	log := log.From(ctx)

	ch, _, err := exporter.ExportCustomers(ctx)
	if err != nil {
		return nil, err
	}

	countNew := 0
	countUpdated := 0
	countUnchanged := 0
	countDeleted := 0
	skippedDeleted := 0

	for customer := range ch {
		existing, err := customers.CustomerByCID(ctx, "vetinf", customer.CustomerID)

		if errors.Is(err, customerdb.ErrNotFound) {
			err = nil
		}

		switch {
		case existing == nil && !customer.Deleted:
			err = customers.CreateCustomer(ctx, &customer.Customer)
			if err == nil {
				countNew++
			}

		case existing == nil && customer.Deleted:
			// TODO(ppacher): create the customer if we use shadow-delete
			skippedDeleted++

		case existing != nil && customer.Deleted:
			err = customers.DeleteCustomer(ctx, existing.ID.Hex())
			if err == nil {
				countDeleted++
			}

		case existing != nil && existing.Hash() != customer.Hash():
			// TODO(ppacher): if we use "shadow-delete" we might need to update
			// as well.
			importutils.CopyCustomerAttributes(existing, &customer.Customer)

			log.V(7).Logf("hashes of customer %d differ: %s != %s: \n\texisting: %+v\n\timported: %+v", customer.ID, existing.Hash(), customer.Hash(), existing, customer.Customer)
			err = customers.UpdateCustomer(ctx, &customer.Customer)
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
		"new":            countNew,
		"updated":        countUpdated,
		"unchanged":      countUnchanged,
		"deleted":        countDeleted,
		"skippedDeleted": skippedDeleted,
	}).Infof("Import finished")

	return &ImportResults{
		New:      countNew,
		Updated:  countUpdated,
		Pristine: countUnchanged,
		Deleted:  countDeleted,
	}, nil
}
