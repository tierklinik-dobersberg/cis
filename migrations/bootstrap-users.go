package migrations

import (
	"context"
	"fmt"
	"os"

	"github.com/hashicorp/go-version"
	"github.com/tierklinik-dobersberg/cis/internal/cfgspec"
	identityProvider "github.com/tierklinik-dobersberg/cis/internal/identity/providers/mongo"
	"github.com/tierklinik-dobersberg/cis/pkg/models/identity/v1alpha"
	"github.com/tierklinik-dobersberg/cis/pkg/passwd"
	"github.com/tierklinik-dobersberg/cis/runtime/schema"
	"github.com/tierklinik-dobersberg/logger"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func init() {
	schema.Add(schema.Migration{
		Description: "Bootstrap user database",
		Key:         "users",
		Version:     "v0.0.1",
		MigrateFunc: func(ctx context.Context, from, to *version.Version, cli *mongo.Database) error {
			// prepare collections
			//
			users := cli.Collection(identityProvider.UserCollection)
			roles := cli.Collection(identityProvider.RoleCollection)

			// prepare indexes
			//
			if _, err := users.Indexes().CreateMany(ctx, []mongo.IndexModel{
				{
					Keys:    bson.D{{Key: "name", Value: 1}},
					Options: options.Index().SetUnique(true),
				},
			}); err != nil {
				return fmt.Errorf("failed to create user indexes: %w", err)
			}

			if _, err := roles.Indexes().CreateMany(ctx, []mongo.IndexModel{
				{
					Keys:    bson.D{{Key: "name", Value: 1}},
					Options: options.Index().SetUnique(true),
				},
			}); err != nil {
				return fmt.Errorf("failed to create role indexes: %w", err)
			}

			// Bootstrap the admin user but only if it does not already exit.
			//
			adminPassword := os.Getenv("CIS_BOOTSTRAP_ADMIN")
			if adminPassword == "" {
				return nil
			}
			hash, err := passwd.Hash(ctx, "bcrypt", adminPassword)
			if err != nil {
				return fmt.Errorf("failed to hash admin password: %w", err)
			}

			adminUser := identityProvider.UserModel{
				User: cfgspec.User{
					User: v1alpha.User{
						Name: "admin",
					},
					PasswordAlgo: "bcrypt",
					PasswordHash: hash,
				},
				Permissions: []cfgspec.Permission{
					{
						Permission: v1alpha.Permission{
							Description: "Built-in admin user",
							Resources:   []string{".*"},
							Domains:     []string{".*"},
							Actions:     []string{".*"},
							Effect:      "allow",
						},
					},
				},
			}
			if _, err := users.InsertOne(ctx, adminUser); err != nil {
				if !mongo.IsDuplicateKeyError(err) {
					return fmt.Errorf("failed to create admin user: %w", err)
				}
				logger.From(ctx).V(2).Logf("admin user already created. Ignoring environment variable CIS_BOOTSTRAP_ADMIN")
			}

			return nil
		},
	})
}
