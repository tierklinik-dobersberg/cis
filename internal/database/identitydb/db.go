package identitydb

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"sync"

	"github.com/google/renameio"
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/cfgspec"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/pkg/passwd"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
	"github.com/tierklinik-dobersberg/cis/runtime/httpcond"
	"golang.org/x/crypto/bcrypt"
)

var log = pkglog.New("identitydb")

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

	// ListAllUsers returns all users stored in the database.
	ListAllUsers(ctx context.Context) ([]cfgspec.User, error)

	// GetUser returns the user object for the user identified by
	// it's name.
	GetUser(ctx context.Context, name string) (cfgspec.User, error)

	// GetRole returns the role object for the role identified by
	// it's name.
	GetRole(ctx context.Context, name string) (cfgspec.Role, error)

	// GetUserPermissions returns a slice of permissions directly attached to
	// the user identified by name.
	GetUserPermissions(ctx context.Context, name string) ([]cfgspec.Permission, error)

	// GetRolePermissions returns a slice of permissions directly attached to
	// the role identified by name.
	GetRolePermissions(ctx context.Context, name string) ([]cfgspec.Permission, error)

	// GetAutologinUsers returns a map that contains the autologin section for each
	// user that has one defined.
	GetAutologinUsers(ctx context.Context) map[string]conf.Section

	// GetAutologinRoles returns a map that contains the autologin section for
	// each role that has one defined.
	GetAutologinRoles(ctx context.Context) map[string]conf.Section

	// SetUserPassword updates the password of the given user.
	SetUserPassword(ctx context.Context, user, password, algo string) error
}

// The actual in-memory implementation for identDB.
type identDB struct {
	dir                   string
	country               string
	userPropertySpecs     []cfgspec.UserPropertyDefinition
	rw                    sync.RWMutex
	httpConditionRegistry *httpcond.Registry
	users                 map[string]*user
	roles                 map[string]*role
	autologinUsers        map[string]conf.Section
	autologinRoles        map[string]conf.Section
}

// New returns a new database that uses ldr.
func New(ctx context.Context, dir, country string, userProperties []cfgspec.UserPropertyDefinition, reg *httpcond.Registry) (Database, error) {
	db := &identDB{
		dir:                   dir,
		httpConditionRegistry: reg,
		userPropertySpecs:     userProperties,
		country:               country,
	}

	if err := db.reload(ctx); err != nil {
		return nil, err
	}

	return db, nil
}

func (db *identDB) Authenticate(ctx context.Context, name, password string) bool {
	log := log.From(ctx)

	db.rw.RLock()
	defer db.rw.RUnlock()

	u, ok := db.users[strings.ToLower(name)]
	if !ok {
		log.Infof("identity: user with name %q does not exist", name)
		return false
	}

	if u.Disabled {
		// TODO(ppacher): incident report!
		log.Infof("identity: user %s is disabled. Authentication denied", name)
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

func (db *identDB) ListAllUsers(ctx context.Context) ([]cfgspec.User, error) {
	db.rw.RLock()
	defer db.rw.RUnlock()

	users := make([]cfgspec.User, 0, len(db.users))
	for _, user := range db.users {
		users = append(users, db.applyPrivacy(ctx, user))
	}

	return users, nil
}

func (db *identDB) GetUser(ctx context.Context, name string) (cfgspec.User, error) {
	db.rw.RLock()
	defer db.rw.RUnlock()

	u, ok := db.users[strings.ToLower(name)]
	if !ok {
		return cfgspec.User{}, httperr.NotFound("user", name, ErrNotFound)
	}

	return db.applyPrivacy(ctx, u), nil
}

func (db *identDB) GetRole(ctx context.Context, name string) (cfgspec.Role, error) {
	db.rw.RLock()
	defer db.rw.RUnlock()

	g, ok := db.roles[strings.ToLower(name)]
	if !ok {
		return cfgspec.Role{}, httperr.NotFound("role", name, ErrNotFound)
	}

	return g.Role, nil
}

func (db *identDB) GetUserPermissions(ctx context.Context, name string) ([]cfgspec.Permission, error) {
	db.rw.RLock()
	defer db.rw.RUnlock()

	u, ok := db.users[strings.ToLower(name)]
	if !ok {
		return nil, httperr.NotFound("user", name, ErrNotFound)
	}

	perms := make([]cfgspec.Permission, len(u.Permissions))
	for idx, p := range u.Permissions {
		perms[idx] = *p
	}
	return perms, nil
}

func (db *identDB) GetRolePermissions(ctx context.Context, name string) ([]cfgspec.Permission, error) {
	db.rw.RLock()
	defer db.rw.RUnlock()

	g, ok := db.roles[strings.ToLower(name)]
	if !ok {
		return nil, httperr.NotFound("role", name, ErrNotFound)
	}

	perms := make([]cfgspec.Permission, len(g.Permissions))
	for idx, p := range g.Permissions {
		perms[idx] = *p
	}
	return perms, nil
}

func (db *identDB) GetAutologinUsers(_ context.Context) map[string]conf.Section {
	db.rw.RLock()
	defer db.rw.RUnlock()

	// create a copy of the map
	m := make(map[string]conf.Section, len(db.autologinUsers))
	for k, v := range db.autologinUsers {
		m[k] = v
	}
	return m
}

func (db *identDB) GetAutologinRoles(_ context.Context) map[string]conf.Section {
	db.rw.RLock()
	defer db.rw.RUnlock()

	// create a copy of the map
	m := make(map[string]conf.Section, len(db.autologinRoles))
	for k, v := range db.autologinRoles {
		m[k] = v
	}
	return m
}

func (db *identDB) SetUserPassword(ctx context.Context, user, password, algo string) error {
	var hash string
	switch algo {
	case "plain":
		hash = password
	case "bcrypt":
		res, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			return err
		}
		hash = string(res)
	default:
		return fmt.Errorf("unsupported password algo: %s", algo)
	}

	db.rw.Lock()
	defer db.rw.Unlock()

	u, ok := db.users[user]
	if !ok {
		return httperr.NotFound("user", user, ErrNotFound)
	}

	// create a shallow copy of u
	// so we don't modify u in place.
	var cu = *u
	u = &cu

	u.PasswordAlgo = algo
	u.PasswordHash = hash
	u.NeedsPasswordChange = false

	opts, err := conf.ConvertToFile(u, "")
	if err != nil {
		return err
	}

	// make sure we add all extra user-properties as well
	// as ConvertToFile will skip them.
	userSec := opts.Get("User")
	if userSec == nil {
		return fmt.Errorf("expected [User] section to exist")
	}
	for _, spec := range db.userPropertySpecs {
		val, ok := u.Properties[spec.Name]
		if !ok {
			continue
		}

		valueOpts, err := conf.EncodeToOptions(spec.Name, val)
		if err != nil {
			return fmt.Errorf("failed to encode user property %s: %w", spec.Name, err)
		}

		userSec.Options = append(userSec.Options, valueOpts...)
	}

	buf := bytes.NewBuffer(nil)
	if err := conf.WriteSectionsTo(opts.Sections, buf); err != nil {
		return err
	}

	path := filepath.Join(db.dir, "identity", user+".user")
	if err := renameio.WriteFile(path, buf.Bytes(), 0600); err != nil {
		return err
	}

	db.users[user] = u
	return nil
}

func (db *identDB) applyPrivacy(ctx context.Context, u *user) cfgspec.User {
	schemaUser := u.User

	schemaUser.Properties = FilterProperties(
		GetScope(ctx),
		db.userPropertySpecs,
		schemaUser.Properties,
	)

	// make sure only internal requests get access to password
	// data.
	if GetScope(ctx) != Internal {
		schemaUser.AvatarFile = ""
		schemaUser.PasswordAlgo = ""
		schemaUser.PasswordHash = ""
	}

	return schemaUser
}

func (db *identDB) reload(ctx context.Context) error {
	db.rw.Lock()
	defer db.rw.Unlock()

	// clear the current user and roles maps
	db.users = make(map[string]*user, len(db.users))
	db.roles = make(map[string]*role, len(db.roles))
	db.autologinUsers = make(map[string]conf.Section, len(db.autologinUsers))
	db.autologinRoles = make(map[string]conf.Section, len(db.autologinRoles))

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

	log.From(ctx).Infof("identity: loaded %d users and %d roles", len(db.users), len(db.roles))

	return nil
}
