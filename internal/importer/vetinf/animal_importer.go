package vetinf

import (
	"context"
	"errors"

	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/database/patientdb"
	"github.com/tierklinik-dobersberg/cis/internal/importer"
	"github.com/tierklinik-dobersberg/logger"
)

func getAnimalImporter(app *app.App, exporter *Exporter) *importer.Instance {
	return &importer.Instance{
		ID:             "vetinf-animals: " + app.Config.VetInfDirectory,
		RunImmediately: true,
		Schedule:       app.Config.VetInfImportSchedule,
		Handler: importer.ImportFunc(func(ctx context.Context) (interface{}, error) {
			log := log.From(ctx)

			ch, _, err := exporter.ExportAnimals(ctx)
			if err != nil {
				return nil, err
			}

			countNew := 0
			countUpdated := 0
			countUnchanged := 0
			countDeleted := 0
			skippedDeleted := 0

			for patient := range ch {
				existing, err := app.Patients.ByCustomerAndAnimalID(
					ctx,
					patient.CustomerSource,
					patient.CustomerID,
					patient.AnimalID,
				)

				if errors.Is(err, patientdb.ErrNotFound) {
					err = nil
				}

				var operation string
				switch {
				case existing == nil && !patient.Deleted:
					operation = "create"
					err = app.Patients.CreatePatient(ctx, &patient.PatientRecord)
					if err == nil {
						countNew++
					}
				case existing == nil && patient.Deleted:
					operation = "skip"
					// TODO(ppacher): revisit if we add shadow-delete support
					skippedDeleted++
				case existing != nil && patient.Deleted:
					operation = "delete"
					err = app.Patients.DeletePatient(ctx, patient.PatientRecord.ID.Hex())
					if err == nil {
						countDeleted++
					}
				case existing != nil && patientdb.RecordHash(patient.PatientRecord) != patientdb.RecordHash(*existing):
					operation = "update"
					patient.ID = existing.ID
					err = app.Patients.UpdatePatient(ctx, &patient.PatientRecord)
					if err == nil {
						countUpdated++
					}

				case existing != nil:
					countUnchanged++
				}

				if err != nil {
					log.Errorf("failed to %s patient: %s", operation, err)
				}
			}
			log.WithFields(logger.Fields{
				"new":            countNew,
				"updated":        countUpdated,
				"unchanged":      countUnchanged,
				"deleted":        countDeleted,
				"skippedDeleted": skippedDeleted,
			}).Infof("Import finished")

			return ImportResults{
				New:      countNew,
				Updated:  countUpdated,
				Pristine: countUnchanged,
				Deleted:  countDeleted,
			}, nil
		}),
	}
}
