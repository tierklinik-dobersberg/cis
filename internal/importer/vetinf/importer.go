package vetinf

import (
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/importer"
)

func init() {
	importer.Register(importer.Factory{
		Name: "vetinf",
		Setup: func(app *app.App) ([]*importer.Instance, error) {
			if app.Config.VetInf.VetInfDirectory == "" {
				return nil, nil
			}

			exporter, err := NewExporter(app.Config.VetInf, app.Config.Country)
			if err != nil {
				return nil, err
			}

			return []*importer.Instance{
				getCustomerImporter(app, exporter),
			}, nil
		},
	})
}
