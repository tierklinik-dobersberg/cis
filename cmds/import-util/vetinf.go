package main

import (
	"fmt"

	"github.com/spf13/cobra"
)

func getVetinfCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "vetinf",
		Short: "Import data from VetInf",
		RunE:  runImportVetinfAll,
	}

	flags := cmd.PersistentFlags()
	{
		flags.StringVarP(&vetinfInfdatDirectory, "infdat", "i", "", "Path to the Infdat directory of VetInf")
		if err := cmd.MarkPersistentFlagRequired("infdat"); err != nil {
			panic(err)
		}
	}

	cmd.AddCommand(
		getImportVetinfCustomersCmd(),
		getImportVetinfPatientsCmd(),
	)

	return cmd
}

func runImportVetinfAll(cmd *cobra.Command, args []string) error {
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
		return fmt.Errorf("failed to import customers: %w", err)
	}

	if err := importVetinfPatients(ctx, exporter, cli); err != nil {
		return fmt.Errorf("failed to import patients: %w", err)
	}

	return nil
}
