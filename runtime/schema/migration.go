package schema

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"

	"github.com/hashicorp/go-version"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
	"github.com/tierklinik-dobersberg/service/svcenv"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

var log = pkglog.New("schema")

// MigrateFunc is the function called to perform the migration between the versions
// from and to.
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
	// BackupCollections can be set to a list of collection names
	// that should be dumped to disk prior to calling MigrateFunc.
	// In case an error is returned by MigrateFunc, all collections
	// listed here are dropped and re-created from the saved dump.
	BackupCollections []string
}

type Registry struct {
	lock     sync.Mutex
	migrates map[string][]Migration
}

func NewRegistry() *Registry {
	return &Registry{
		migrates: make(map[string][]Migration),
	}
}

func (sr *Registry) Add(migration ...Migration) {
	sr.lock.Lock()
	defer sr.lock.Unlock()

	for _, m := range migration {
		sr.migrates[m.Key] = append(sr.migrates[m.Key], m)
	}
}

func (sr *Registry) ApplyMigrations(ctx context.Context, db Database, cli *mongo.Database) (bool, error) {
	sr.lock.Lock()
	defer sr.lock.Unlock()

	migrated := false
	for key, migrations := range sr.migrates {
		from, to, steps, err := sr.migrate(ctx, db, cli, key, migrations)
		if err != nil {
			return migrated, fmt.Errorf("%s: %w", key, err)
		}
		if from != to {
			migrated = true
			log.From(ctx).Infof("migrated %s from %s to %s in %d steps", key, from, to, steps)
		}
	}

	return migrated, nil
}

// backupCollections creates a backup of all 'collections' storing them at the StateDirectory using t
// for the filename.
func (sr *Registry) backupCollections(ctx context.Context, cli *mongo.Database, key string, collections []string, t time.Time) error {
	if len(collections) == 0 {
		return nil
	}
	dumpDir := filepath.Join(
		svcenv.Env().StateDirectory,
		"dumps",
	)
	if err := os.MkdirAll(dumpDir, 0700); err != nil {
		return fmt.Errorf("failed to create migration dump directory at %s: %q", dumpDir, err)
	}
	for _, colName := range collections {
		col := cli.Collection(colName)
		cursor, err := col.Find(ctx, bson.M{})
		if err != nil {
			return err
		}
		defer cursor.Close(ctx)

		dumpFile, err := os.Create(
			filepath.Join(
				dumpDir,
				fmt.Sprintf("%s-%s-%d.json", key, colName, t.UnixNano()),
			),
		)
		if err != nil {
			return err
		}

		encoder := json.NewEncoder(dumpFile)
		encoder.SetIndent("", "  ")
		encoder.SetEscapeHTML(false)

		for cursor.Next(ctx) {
			var x interface{}
			if err := cursor.Decode(&x); err != nil {
				return err
			}
			if err := encoder.Encode(x); err != nil {
				return err
			}
		}
		if err := dumpFile.Close(); err != nil {
			return err
		}
	}
	return nil
}

func (sr *Registry) migrate(ctx context.Context, db Database, cli *mongo.Database, key string, migrations []Migration) (
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
			t := time.Now()
			if err := sr.backupCollections(ctx, cli, key, m.BackupCollections, t); err != nil {
				return from, currentVersion, steps, fmt.Errorf("failed to create backup: %w", err)
			}
			if err := m.MigrateFunc(ctx, currentVersion, ver, cli); err != nil {
				// TODO(ppacher): should we try to restore the collections? We should at least have a dump
				// file around.
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
var Default = NewRegistry()

// Add adds m to the default schema registry.
func Add(m ...Migration) {
	Default.Add(m...)
}

// ApplyMigrations applies all migrations added to the default schema
// registry. See SchemaRegistry.ApplyMigrations for more information.
func ApplyMigrations(ctx context.Context, db Database, cli *mongo.Database) (bool, error) {
	return Default.ApplyMigrations(ctx, db, cli)
}
