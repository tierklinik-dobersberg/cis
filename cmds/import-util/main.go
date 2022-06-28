package main

import (
	"context"
	"fmt"
	"log"

	"github.com/spf13/cobra"
	"github.com/tierklinik-dobersberg/cis/internal/importer/vetinf"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var (
	mongoServerURI        string
	databaseName          string
	vetinfInfdatDirectory string
	country               string
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
	}

	flags := cmd.PersistentFlags()
	{
		flags.StringVarP(&mongoServerURI, "mongo-server", "s", "", "The connection URI for the MongoDB server")
		if err := cmd.MarkPersistentFlagRequired("mongo-server"); err != nil {
			panic(err)
		}

		flags.StringVarP(&databaseName, "db", "d", "", "The name of the CIS database to import data to")
		if err := cmd.MarkPersistentFlagRequired("db"); err != nil {
			panic(err)
		}

		flags.StringVarP(&country, "country", "c", "", "The country code to use when parsing national phone numbers")
		if err := cmd.MarkPersistentFlagRequired("country"); err != nil {
			panic(err)
		}
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
	}, country)
	if err != nil {
		return nil, err
	}

	return exporter, nil
}

func getBaseCtx() context.Context {
	return context.Background()
}
