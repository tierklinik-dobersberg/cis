package main

import (
	"context"
	"fmt"

	"github.com/spf13/cobra"
	"github.com/tierklinik-dobersberg/cis/internal/database/customerdb"
	"github.com/tierklinik-dobersberg/cis/internal/importer/vetinf"
	"go.mongodb.org/mongo-driver/mongo"
)

func getImportVetinfCustomersCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "customers",
		Short: "Import VetInf patient data",
		RunE:  runImportVetinfCustomers,
	}
}

func runImportVetinfCustomers(cmd *cobra.Command, args []string) error {
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

	if err := importVetinfCustomers(ctx, exporter, cli); err != nil {
		return fmt.Errorf("failed to import patients: %w", err)
	}

	return nil
}

func importVetinfCustomers(ctx context.Context, exporter *vetinf.Exporter, cli *mongo.Client) error {
	customersDB, err := customerdb.NewWithClient(ctx, databaseName, cli)
	if err != nil {
		return err
	}

	_, err = vetinf.ImportCustomers(ctx, exporter, customersDB)
	if err != nil {
		return err
	}

	return nil
}
