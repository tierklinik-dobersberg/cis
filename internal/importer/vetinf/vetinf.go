package vetinf

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"sync"

	"github.com/nyaruka/phonenumbers"
	"github.com/spf13/afero"
	"github.com/tierklinik-dobersberg/cis/internal/cfgspec"
	"github.com/tierklinik-dobersberg/cis/internal/database/customerdb"
	"github.com/tierklinik-dobersberg/cis/internal/database/identitydb"
	"github.com/tierklinik-dobersberg/cis/pkg/models/patient/v1alpha"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
	"github.com/tierklinik-dobersberg/go-vetinf/vetinf"
	"github.com/tierklinik-dobersberg/logger"
)

var log = pkglog.New("vetinf")

// ExportedCustomer is a customer exported from a VetInf
// installation.
type ExportedCustomer struct {
	customerdb.Customer
	Deleted bool
}

// ExportedAnimal is a animal patient record exported from a
// VetInf installation.
type ExportedAnimal struct {
	v1alpha.PatientRecord
	Deleted bool
}

// Exporter is capable of exporting and extracting
// data of a VetInf installation.
type Exporter struct {
	cfg      cfgspec.VetInf
	db       *vetinf.Infdat
	country  string
	usersMap map[int]string

	identities    identitydb.Database
	loadUsersOnce sync.Once
}

type ImportResults struct {
	New      int
	Pristine int
	Updated  int
	Deleted  int
}

// NewExporter creates a new exporter for vetinf.
func NewExporter(cfg cfgspec.VetInf, country string, users identitydb.Database) (*Exporter, error) {
	stat, err := os.Stat(cfg.VetInfDirectory)
	if err != nil {
		return nil, err
	}

	if !stat.IsDir() {
		return nil, fmt.Errorf("%q is not a directory", cfg.VetInfDirectory)
	}

	infdat := vetinf.OpenReadonlyFs(cfg.VetInfDirectory, afero.NewOsFs())

	return &Exporter{
		db:         infdat,
		cfg:        cfg,
		country:    country,
		identities: users,
	}, nil
}

func (e *Exporter) buildUsersMap() error {
	// create a lookup map for converting vetinf user identifiers to
	// user names CIS knows.
	// TODO(ppacher): this needs to be redone once we support config/identity
	// reload.
	e.usersMap = make(map[int]string)
	if e.cfg.VetInfUserIDProperty != "" {
		ctx := identitydb.WithScope(context.Background(), identitydb.Internal)
		allUsers, err := e.identities.ListAllUsers(ctx)
		if err != nil {
			return fmt.Errorf("failed to build user-lookup map: %s", err)
		}

		for _, u := range allUsers {
			prop, ok := u.Properties[e.cfg.VetInfUserIDProperty]
			if !ok {
				continue
			}

			switch v := prop.(type) {
			case int:
				e.usersMap[v] = u.Name
			case string:
				d, err := strconv.ParseInt(v, 10, 64)
				if err != nil {
					return fmt.Errorf("failed to parse VetInf user ID %q for user %s: %w", u.Name, v, err)
				}
				e.usersMap[int(d)] = u.Name
			default:
				return fmt.Errorf("unsupported type for VetInf user ID in user %s: %T", u.Name, prop)
			}
		}
	}

	return nil
}

func (e *Exporter) getUserNameById(userId int) string {
	e.loadUsersOnce.Do(func() {
		if err := e.buildUsersMap(); err != nil {
			log.From(context.Background()).Errorf("failed to build vetinf user lookup map: %s", err)
		}
	})

	if u, ok := e.usersMap[userId]; ok {
		return u
	}
	return fmt.Sprintf("<%d>", userId)
}

// ExportCustomers exports all vetinf customers and streams them to
// the returned channel. Errors encountered when exporting single
// customers are logged and ignored.
func (e *Exporter) ExportCustomers(ctx context.Context) (<-chan *ExportedCustomer, int, error) {
	log := log.From(ctx)

	customerDB, err := e.db.CustomerDB(e.cfg.VetInfEncoding)
	if err != nil {
		return nil, 0, err
	}

	dataCh, errCh, total := customerDB.StreamAll(ctx)

	customers := make(chan *ExportedCustomer, 10)

	go func() {
		for err := range errCh {
			log.Errorf("export: %s", err)
		}
	}()

	go func() {
		defer close(customers)
		for customer := range dataCh {
			//textparse.PhoneNumber(ctx, customer.Phone)

			dbCustomer := &ExportedCustomer{
				Customer: customerdb.Customer{
					CustomerID: customer.ID,
					City:       customer.City,
					CityCode:   customer.CityCode,
					Firstname:  customer.Firstname,
					Group:      customer.Group,
					Name:       customer.Name,
					Street:     customer.Street,
					Title:      customer.Titel,
					Source:     "vetinf",
					Metadata: map[string]interface{}{
						"rawVetInfRecord": customer,
					},
					VaccinationReminder: customer.WantsVaccinationReminder(),
				},
				Deleted: customer.Meta.Deleted,
			}

			key := fmt.Sprintf("[%s %s <cid:%d>]", dbCustomer.Name, dbCustomer.Firstname, dbCustomer.CustomerID)

			var hasInvalidPhone bool

			// Add all possible phPropertiesone numbers
			if customer.Phone != "" {
				dbCustomer.PhoneNumbers = addNumber(key, dbCustomer.PhoneNumbers, customer.Phone, e.country, &hasInvalidPhone)
			}
			if customer.Phone2 != "" {
				dbCustomer.PhoneNumbers = addNumber(key, dbCustomer.PhoneNumbers, customer.Phone2, e.country, &hasInvalidPhone)
			}
			if customer.MobilePhone1 != "" {
				dbCustomer.PhoneNumbers = addNumber(key, dbCustomer.PhoneNumbers, customer.MobilePhone1, e.country, &hasInvalidPhone)
			}
			if customer.MobilePhone2 != "" {
				dbCustomer.PhoneNumbers = addNumber(key, dbCustomer.PhoneNumbers, customer.MobilePhone2, e.country, &hasInvalidPhone)
			}

			// add all possible mail addresses
			if customer.Mail != "" {
				dbCustomer.MailAddresses = append(dbCustomer.MailAddresses, customer.Mail)
			}

			if hasInvalidPhone {
				log.Infof("customer %s has invalid phone numer", key)
				dbCustomer.Metadata["vetinfInvalidPhone"] = true
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

func (e *Exporter) ExportAnimals(ctx context.Context) (<-chan *ExportedAnimal, int, error) {
	log := log.From(ctx)
	animaldb, err := e.db.AnimalDB(e.cfg.VetInfEncoding)
	if err != nil {
		return nil, 0, err
	}

	dataCh, errCh, total := animaldb.StreamAll(ctx)
	records := make(chan *ExportedAnimal, 100)

	go func() {
		for err := range errCh {
			log.Errorf("export: %s", err)
		}
	}()

	go func() {
		defer close(records)
		for animal := range dataCh {
			exported := &ExportedAnimal{
				PatientRecord: v1alpha.PatientRecord{
					AnimalID:       animal.AnimalID,
					CustomerSource: "vetinf",
					CustomerID:     animal.CustomerID,
					Size:           animal.Size,
					Species:        animal.Species,
					Breed:          animal.Breed,
					Birthday:       animal.Birthday,
					Gender:         animal.Gender,
					Name:           animal.Name,
					SpecialDetail:  animal.SpecialDetail,
					Color:          animal.Color,
					ChipNumber:     animal.ChipNumber,
				},
				Deleted: animal.Meta.Deleted,
			}

			if animal.Extra1 != "" {
				exported.Notes = append(exported.Notes, animal.Extra1)
			}
			if animal.Extra2 != "" {
				exported.Notes = append(exported.Notes, animal.Extra2)
			}
			if animal.Extra3 != "" {
				exported.Notes = append(exported.Notes, animal.Extra3)
			}
			if animal.Extra4 != "" {
				exported.Notes = append(exported.Notes, animal.Extra4)
			}
			if animal.Extra5 != "" {
				exported.Notes = append(exported.Notes, animal.Extra5)
			}
			if animal.Extra6 != "" {
				exported.Notes = append(exported.Notes, animal.Extra6)
			}
			if animal.Extra7 != "" {
				exported.Notes = append(exported.Notes, animal.Extra7)
			}
			if animal.Extra8 != "" {
				exported.Notes = append(exported.Notes, animal.Extra8)
			}
			if animal.Extra9 != "" {
				exported.Notes = append(exported.Notes, animal.Extra9)
			}
			if animal.Extra10 != "" {
				exported.Notes = append(exported.Notes, animal.Extra10)
			}

			select {
			case records <- exported:
			case <-ctx.Done():
				return
			}
		}
	}()

	return records, total, nil
}

func addNumber(id string, numbers []string, number, country string, hasError *bool) []string {
	p, err := phonenumbers.Parse(number, country)
	if err != nil {
		*hasError = true
		// FIXME(ppacher): provide logger
		logger.DefaultLogger().Infof("%s failed to parse phone number: %q in country %s: %s", id, number, country, err)
		return numbers
	}

	return append(numbers, []string{
		phonenumbers.Format(p, phonenumbers.NATIONAL),
		phonenumbers.Format(p, phonenumbers.INTERNATIONAL),
	}...)
}
