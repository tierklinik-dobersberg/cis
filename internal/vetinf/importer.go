package vetinf

import (
	"context"
	"errors"

	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/database/customerdb"
	"github.com/tierklinik-dobersberg/cis/internal/importer"
	"github.com/tierklinik-dobersberg/logger"
)

func init() {
	importer.Register(importer.Factory{
		Name: "vetinf",
		Setup: func(app *app.App) ([]importer.Instance, error) {
			if app.Config.VetInf.VetInfDirectory == "" {
				return nil, nil
			}

			exporter, err := NewExporter(app.Config.VetInf)
			if err != nil {
				return nil, err
			}

			return []importer.Instance{
				{
					ID:       "vetinf:" + app.Config.VetInfDirectory,
					Schedule: app.Config.VetInfImportSchedule,
					Handler: importer.ImportFunc(func() error {
						ctx := context.Background()

						ch, _, err := exporter.ExportCustomers(ctx)
						if err != nil {
							return err
						}

						for customer := range ch {
							existing, err := app.Customers.CustomerByCID(ctx, customer.CustomerID)
							if errors.Is(err, customerdb.ErrNotFound) {
								err = app.Customers.CreateCustomer(ctx, customer)
							} else if existing != nil && existing.Hash() != customer.Hash() {
								customer.ID = existing.ID
								err = app.Customers.UpdateCustomer(ctx, customer)
							}

							if err != nil {
								logger.From(ctx).Errorf("failed to import customer %s: %s", customer.CustomerID, err)
							}
						}

						return nil
					}),
				},
			}, nil
		},
	})
}
