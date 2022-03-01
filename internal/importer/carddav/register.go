package carddav

import (
	"context"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/importer"
	"github.com/tierklinik-dobersberg/cis/runtime"
	"github.com/tierklinik-dobersberg/logger"
)

func Register(manager *importer.Manager) error {
	return manager.Register(importer.Factory{
		Schema: runtime.Schema{
			Name:        "carddav",
			DisplayName: "CardDAV",
			Description: "Import and synchronize customer data with an external CardDAV server",
			SVGData:     `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />`,
			Spec:        CardDAVSpec,
			Multi:       true,
			Annotations: new(conf.Annotation).With(
				runtime.OverviewFields("ID", "Source", "Server", "Schedule"),
			),
		},
		FactoryFunc: func(ctx context.Context, app *app.App, config runtime.Section) ([]*importer.Instance, error) {
			var cfg CardDAVConfig
			if err := config.Decode(CardDAVSpec, &cfg); err != nil {
				return nil, err
			}

			if cfg.AddressBook == "" {
				cli, err := NewClient(&cfg)
				if err != nil {
					return nil, err
				}
				// determine the addressbook to use and update cfg.AddressBook so this
				// importer instance always uses the same addressbook.
				err = findAddressBook(ctx, config.ID, cli, &cfg)
				if err != nil {
					logger.From(ctx).Errorf("failed to find default addressbook: %w", err)
				} else {
					found := false
					for idx, opt := range config.Options {
						if opt.Name == "AddressBook" {
							found = true
							config.Options[idx].Value = cfg.AddressBook

							break
						}
					}
					if !found {
						config.Options = append(config.Options, conf.Option{
							Name:  "AddressBook",
							Value: cfg.AddressBook,
						})
					}

					go func() {
						err := manager.Config().Update(context.Background(), config.ID, config.Name, config.Options)
						if err != nil {
							logger.From(ctx).Errorf("failed to update configuration with detected address book %s: %s", cfg.AddressBook, err)
						} else {
							logger.From(ctx).Infof("updated carddav configuration with auto-detected addressbook: %s", cfg.AddressBook)
						}
					}()
					// we ignore that for now because we should get notified
					// for the update as wel.
					return nil, nil
				}
			}

			instance, err := getImporter(app, cfg)
			if err != nil {
				return nil, err
			}

			return []*importer.Instance{instance}, nil
		},
	})
}
