package vetinf

import (
	"context"
	"strings"

	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/importer"
	"github.com/tierklinik-dobersberg/cis/runtime"
)

func Register(ctx context.Context, manager *importer.Manager) error {
	return manager.Register(ctx, importer.Factory{
		Schema: runtime.Schema{
			Name:        "vetinf",
			DisplayName: "VetInf",
			Description: "Configure import from a VetINF installation",
			SVGData:     `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />`,
			Spec:        VetInfSpec,
			Category:    "Kundendaten",
			Multi:       false,
		},
		FactoryFunc: func(ctx context.Context, app *app.App, config runtime.Section) ([]*importer.Instance, error) {
			var cfg VetInf

			if err := config.Decode(VetInfSpec, &cfg); err != nil {
				return nil, err
			}

			exporter, err := NewExporter(cfg, app.Config.Country)
			if err != nil {
				return nil, err
			}

			ci, err := getCustomerImporter(cfg, app.Customers, exporter)
			if err != nil {
				return nil, err
			}
			ai, err := getAnimalImporter(cfg, app.Patients, exporter)
			if err != nil {
				return nil, err
			}

			return []*importer.Instance{ci, ai}, nil
		},
	})
}

// convertToID converts a "filepath" like string
// to be usable for event ids by replacing "/" with "-".
func convertToID(path string) string {
	return strings.ReplaceAll(path, "/", "-")
}
