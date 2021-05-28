package schema

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"sync"

	"github.com/hashicorp/go-version"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
	"go.mongodb.org/mongo-driver/mongo"
)

var log = pkglog.New("schema")

type MigrateFunc func(ctx context.Context, from, to *version.Version, cli *mongo.Database) error

type Migration struct {
	// Description provides a short description of the migration.
	Description string
	// Key identifies the subsystem / migratable part this migration is
	// for.
	Key string
	// Version is the semver that requires this migration to be run.
	Version string
	// MigrateFunc is called when the migration is applied.
	MigrateFunc MigrateFunc
}

type SchemaRegistry struct {
	lock     sync.Mutex
	migrates map[string][]Migration
}

func NewSchemaRegistry() *SchemaRegistry {
	return &SchemaRegistry{
		migrates: make(map[string][]Migration),
	}
}

func (sr *SchemaRegistry) Add(migration ...Migration) {
	sr.lock.Lock()
	defer sr.lock.Unlock()

	for _, m := range migration {
		sr.migrates[m.Key] = append(sr.migrates[m.Key], m)
	}
}

func (sr *SchemaRegistry) ApplyMigrations(ctx context.Context, db Database, cli *mongo.Database) (bool, error) {
	sr.lock.Lock()
	defer sr.lock.Unlock()

	migrated := false
	for key, migrations := range sr.migrates {
		from, to, steps, err := sr.migrate(ctx, db, cli, key, migrations)
		if err != nil {
			return migrated, err
		}
		if from != to {
			migrated = true
			log.From(ctx).Infof("migrated %s from %s to %s in %s steps", key, from, to, steps)
		}
	}

	return migrated, nil
}

func (sr *SchemaRegistry) migrate(ctx context.Context, db Database, cli *mongo.Database, key string, migrations []Migration) (
	from,
	to *version.Version,
	steps int, err error) {
	// split them up by version
	lm := make(map[string][]Migration)
	versions := version.Collection{}

	for _, m := range migrations {
		ver, err := version.NewSemver(m.Version)
		if err != nil {
			return nil, nil, 0, err
		}
		lm[ver.String()] = append(lm[ver.String()], m)
		versions = append(versions, ver)
	}

	sort.Sort(versions)

	current, err := db.Load(ctx, key)
	if err != nil && !errors.Is(err, ErrNotFound) {
		return nil, nil, 0, err
	}

	var currentVersion *version.Version
	if current != nil {
		currentVersion, err = version.NewSemver(current.Version)
		if err != nil {
			return nil, nil, 0, err
		}
	}
	from = currentVersion

	for _, ver := range versions {
		// skip this migration if the current version is already higher.
		if currentVersion != nil && currentVersion.GreaterThanOrEqual(ver) {
			continue
		}
		migrations := lm[ver.String()]
		for _, m := range migrations {
			if err := m.MigrateFunc(ctx, currentVersion, ver, cli); err != nil {
				return from, currentVersion, steps, fmt.Errorf("%s -> %s: %w", currentVersion, ver, err)
			}
		}
		steps++
		if err := db.Save(ctx, key, ver.String()); err != nil {
			return from, currentVersion, steps, fmt.Errorf("failed to save successfully applied migration to version %s", ver)
		}
		currentVersion = ver
	}

	return from, currentVersion, steps, nil
}

// Default is the default schema registry and used by package level
// functions Add and ApplyMigrations
var Default = NewSchemaRegistry()

// Add adds m to the default schema registry.
func Add(m ...Migration) {
	Default.Add(m...)
}

// ApplyMigrations applies all migrations added to the default schema
// registy. See SchemaRegistry.ApplyMigrations for more information.
func ApplyMigrations(ctx context.Context, db Database, cli *mongo.Database) (bool, error) {
	return Default.ApplyMigrations(ctx, db, cli)
}
