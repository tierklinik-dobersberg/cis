package main

import (
	"context"
	"fmt"

	"github.com/spf13/cobra"
	"github.com/tierklinik-dobersberg/cis/internal/database/patientdb"
	"github.com/tierklinik-dobersberg/cis/internal/importer/vetinf"
	"go.mongodb.org/mongo-driver/mongo"
)

func getImportVetinfPatientsCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "patients",
		Short: "Import VetInf patient data",
		RunE:  runImportVetinfPatients,
	}
}

func runImportVetinfPatients(cmd *cobra.Command, args []string) error {
	ctx := getBaseCtx()

	cli, err := getMongoClient(ctx, mongoServerURI)
	if err != nil {
		return err
	}

	if err := checkDatabaseExists(ctx, cli); err != nil {
		return err
	}

	exporter, err := getVetinfExporter()
	if err != nil {
		return fmt.Errorf("failed to get vetinf exporter: %w", err)
	}

	if err := importVetinfPatients(ctx, exporter, cli); err != nil {
		return fmt.Errorf("failed to import patients: %w", err)
	}

	return nil
}

func importVetinfPatients(ctx context.Context, exporter *vetinf.Exporter, cli *mongo.Client) error {
	patientsDB, err := patientdb.NewWithClient(ctx, databaseName, cli)
	if err != nil {
		return err
	}

	_, err = vetinf.ImportPatients(ctx, exporter, patientsDB)
	if err != nil {
		return err
	}

	return nil
}
