package identitydb

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"sync"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/httpcond"
	"github.com/tierklinik-dobersberg/cis/internal/passwd"
	"github.com/tierklinik-dobersberg/cis/internal/schema"
	"github.com/tierklinik-dobersberg/logger"
)

var (
	// ErrNotFound is returned when the requested user or role does not
	// exist.
	ErrNotFound = errors.New("not found")
	// ErrInvalidSectionCount indicates that eigher to much or to less sections
	// of a specific kind are found in file.
	ErrInvalidSectionCount = errors.New("unexpected number of sections")
)

// Database describes the interface exposed by the identity database.
type Database interface {
	// Authenticate tries to authenticate a user. It returns true if the user/
	// password is correct. False otherwise.
	Authenticate(ctx context.Context, name string, password string) bool

	// GetUser returns the user object for the user identified by
	// it's name.
	GetUser(ctx context.Context, name string) (schema.User, error)

	// GetRole returns the role object for the role identified by
	// it's name.
	GetRole(ctx context.Context, name string) (schema.Role, error)

	// GetUserPermissions returns a slice of permissions directly attached to
	// the user identified by name.
	GetUserPermissions(ctx context.Context, name string) ([]schema.Permission, error)

	// GetRolePermissions returns a slice of permissions directly attached to
	// the role identified by name.
	GetRolePermissions(ctx context.Context, name string) ([]schema.Permission, error)

	// GetAutologinUsers returns a map that contains the autologin section for each
	// user that has one defined.
	GetAutologinUsers(ctx context.Context) map[string]conf.Section
}

// The actual in-memory implementation for identDB.
type identDB struct {
	dir                 string
	userPropertySpecs   []conf.OptionSpec
	rw                  sync.RWMutex
	autologinConditions *httpcond.Registry
	users               map[string]*user
	roles               map[string]*role
	autologin           map[string]conf.Section
}

// New returns a new database that uses ldr.
func New(ctx context.Context, dir string, userProperties []conf.OptionSpec, reg *httpcond.Registry) (Database, error) {
	db := &identDB{
		dir:                 dir,
		autologinConditions: reg,
		userPropertySpecs:   userProperties,
	}

	if err := db.reload(ctx); err != nil {
		return nil, err
	}

	return db, nil
}

func (db *identDB) Authenticate(ctx context.Context, name, password string) bool {
	log := logger.From(ctx)

	db.rw.RLock()
	defer db.rw.RUnlock()

	u, ok := db.users[strings.ToLower(name)]
	if !ok {
		log.Infof("identity: user with name %q does not exist", name)
		return false
	}

	if u.PasswordAlgo == "" {
		log.Infof("identity: user with name %q does not have a password", name)
		return false
	}

	match, err := passwd.Compare(ctx, u.PasswordAlgo, u.Name, u.PasswordHash, password)
	if err != nil {
		log.Errorf("identity: failed to validate password for user %q: %s", name, err)
	}

	return match
}

func (db *identDB) GetUser(ctx context.Context, name string) (schema.User, error) {
	db.rw.RLock()
	defer db.rw.RUnlock()

	u, ok := db.users[strings.ToLower(name)]
	if !ok {
		return schema.User{}, ErrNotFound
	}

	return u.User, nil
}

func (db *identDB) GetRole(ctx context.Context, name string) (schema.Role, error) {
	db.rw.RLock()
	defer db.rw.RUnlock()

	g, ok := db.roles[strings.ToLower(name)]
	if !ok {
		return schema.Role{}, ErrNotFound
	}

	return g.Role, nil
}

func (db *identDB) GetUserPermissions(ctx context.Context, name string) ([]schema.Permission, error) {
	db.rw.RLock()
	defer db.rw.RUnlock()

	u, ok := db.users[strings.ToLower(name)]
	if !ok {
		return nil, ErrNotFound
	}

	perms := make([]schema.Permission, len(u.Permissions))
	for idx, p := range u.Permissions {
		perms[idx] = *p
	}
	return perms, nil
}

func (db *identDB) GetRolePermissions(ctx context.Context, name string) ([]schema.Permission, error) {
	db.rw.RLock()
	defer db.rw.RUnlock()

	g, ok := db.roles[strings.ToLower(name)]
	if !ok {
		return nil, ErrNotFound
	}

	perms := make([]schema.Permission, len(g.Permissions))
	for idx, p := range g.Permissions {
		perms[idx] = *p
	}
	return perms, nil
}

func (db *identDB) GetAutologinUsers(_ context.Context) map[string]conf.Section {
	db.rw.RLock()
	defer db.rw.RUnlock()

	// create a copy of the map
	m := make(map[string]conf.Section, len(db.autologin))
	for k, v := range db.autologin {
		m[k] = v
	}
	return m
}

func (db *identDB) reload(ctx context.Context) error {
	db.rw.Lock()
	defer db.rw.Unlock()

	// clear the current user and roles maps
	db.users = make(map[string]*user, len(db.users))
	db.roles = make(map[string]*role, len(db.roles))
	db.autologin = make(map[string]conf.Section, len(db.autologin))

	identityDir := filepath.Join(db.dir, "identity")

	// load all users files
	if err := db.loadUsers(identityDir); err != nil {
		return fmt.Errorf("loading users: %w", err)
	}

	// load all roles files
	if err := db.loadRoles(identityDir); err != nil {
		return fmt.Errorf("loading roles: %w", err)
	}

	// check all user.Roles actually exist
	for _, u := range db.users {
		for _, roleNames := range u.Roles {
			if _, ok := db.roles[strings.ToLower(roleNames)]; !ok {
				return fmt.Errorf("%s: member of %s: %w", u.Name, roleNames, ErrNotFound)
			}
		}
	}

	logger.Infof(ctx, "identity: loaded %d users and %d roles", len(db.users), len(db.roles))

	return nil
}
