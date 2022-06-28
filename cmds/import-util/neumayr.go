package main

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"github.com/tierklinik-dobersberg/cis/internal/database/customerdb"
	"github.com/tierklinik-dobersberg/cis/internal/importer/neumayr"
)

func getNeumayrCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "neumayr",
		Short: "Import customer data from Neumayr",
		Args:  cobra.ExactArgs(1),
		RunE:  runImportNeumayr,
	}

	return cmd
}

func runImportNeumayr(cmd *cobra.Command, args []string) error {
	ctx := getBaseCtx()

	cli, err := getMongoClient(ctx, mongoServerURI)
	if err != nil {
		return err
	}

	if err := checkDatabaseExists(ctx, cli); err != nil {
		return err
	}

	customers, err := customerdb.NewWithClient(ctx, databaseName, cli)
	if err != nil {
		return err
	}

	f, err := os.Open(args[0])
	if err != nil {
		return fmt.Errorf("failed to open file: %w", err)
	}
	defer f.Close()

	importer := neumayr.NewImporter(country, customers)

	_, _, _, err = importer.Import(ctx, f)
	if err != nil {
		return fmt.Errorf("failed to import: %w", err)
	}

	return nil
}
