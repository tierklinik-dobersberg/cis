package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/spf13/cobra"
	"github.com/tierklinik-dobersberg/cis/internal/importer/vetinf"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var (
	mongoServerURI string
	databaseName   string
	country        string
)

func main() {
	if err := getRootCmd().Execute(); err != nil {
		log.Fatalf(err.Error())
	}
}

func getRootCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "import",
		Short: "Import data from various sources",
		PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
			if mongoServerURI == "" {
				return fmt.Errorf("--mongo-server/-s is required")
			}
			if databaseName == "" {
				return fmt.Errorf("--db/-d is required")
			}
			if country == "" {
				return fmt.Errorf("--country/-c is required")
			}

			return nil
		},
	}

	flags := cmd.PersistentFlags()
	{
		flags.StringVarP(&mongoServerURI, "mongo-server", "s", os.Getenv("DATABASE_URI"), "The connection URI for the MongoDB server")
		flags.StringVarP(&databaseName, "db", "d", os.Getenv("DATABASE_NAME"), "The name of the CIS database to import data to")
		flags.StringVarP(&country, "country", "c", os.Getenv("COUNTRY"), "The country code to use when parsing national phone numbers")
	}

	cmd.AddCommand(
		getVetinfCmd(),
		getNeumayrCmd(),
	)

	return cmd
}

// getMongoClient returns anew mongo-db client connected to uri.
func getMongoClient(ctx context.Context, uri string) (*mongo.Client, error) {
	clientConfig := options.Client().ApplyURI(uri)
	client, err := mongo.NewClient(clientConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create client: %w", err)
	}

	if err := client.Connect(ctx); err != nil {
		return nil, fmt.Errorf("failed to connect to server: %w", err)
	}

	return client, nil
}

func checkDatabaseExists(ctx context.Context, cli *mongo.Client) error {
	dbNames, err := cli.ListDatabaseNames(ctx, bson.M{"name": databaseName})
	if err != nil {
		return fmt.Errorf("failed to get database names: %w", err)
	}
	if len(dbNames) == 0 {
		return fmt.Errorf("database %s does not exist", databaseName)
	}

	return nil
}

func getVetinfExporter() (*vetinf.Exporter, error) {
	exporter, err := vetinf.NewExporter(vetinf.VetInf{
		Directory: vetinfInfdatDirectory,
		Encoding:  vetinfEncoding,
	}, country)
	if err != nil {
		return nil, err
	}

	return exporter, nil
}

func getBaseCtx() context.Context {
	return context.Background()
}
