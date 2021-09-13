package vetinf

import (
	"strings"

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

			exporter, err := NewExporter(app.Config.VetInf, app.Config.Country, app.Identities)
			if err != nil {
				return nil, err
			}

			return []*importer.Instance{
				getCustomerImporter(app, exporter),
				getAnimalImporter(app, exporter),
			}, nil
		},
	})
}

// convertToID converts a "filepath" like string
// to be usable for event ids by replacing "/" with "-"
func convertToID(path string) string {
	return strings.ReplaceAll(path, "/", "-")
}
