package carddav

import (
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/importer"
)

func init() {
	importer.Register(importer.Factory{
		Name: "carddav",
		Setup: func(app *app.App) ([]*importer.Instance, error) {
			return nil, nil
		},
	})
}