package file

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
	"github.com/tierklinik-dobersberg/cis/internal/identity"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/pkg/passwd"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
	"github.com/tierklinik-dobersberg/cis/runtime"
)

var log = pkglog.New("file")

var (
	// ErrNotFound is returned when the requested user or role does not
	// exist.
	ErrNotFound = errors.New("not found")
	// ErrInvalidSectionCount indicates that eigher to much or to less sections
	// of a specific kind are found in file.
	ErrInvalidSectionCount = errors.New("unexpected number of sections")
)

// The actual in-memory implementation for identDB.
type identDB struct {
	dir     string
	country string
	cfg     *runtime.ConfigSchema
	rw      sync.RWMutex
	users   map[string]*UserModel
	roles   map[string]*roleModel
}

// New returns a new database that uses ldr.
func New(ctx context.Context, dir, country string, cfg *runtime.ConfigSchema) (identity.Provider, error) {
	db := &identDB{
		dir:     dir,
		country: country,
		cfg:     cfg,
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

	if u.Disabled != nil && *u.Disabled {
		// TODO(ppacher): incident report!
		log.Infof("identity: user %s is disabled. Authentication denied", name)

		return false
	}

	if u.PasswordAlgo == "" {
		log.Infof("identity: user with name %q does not have a password", name)

		return false
	}

	match, err := passwd.Compare(ctx, u.PasswordAlgo, u.PasswordHash, password)
	if err != nil {
		log.Errorf("identity: failed to validate password for user %q: %s", name, err)
	}

	return match
}

func (db *identDB) ListAllUsers(ctx context.Context) ([]identity.User, error) {
	db.rw.RLock()
	defer db.rw.RUnlock()

	users := make([]identity.User, 0, len(db.users))
	for _, user := range db.users {
		users = append(users, db.applyPrivacy(ctx, user))
	}

	return users, nil
}

func (db *identDB) ListRoles(ctx context.Context) ([]identity.Role, error) {
	db.rw.RLock()
	defer db.rw.RUnlock()

	roles := make([]identity.Role, 0, len(db.roles))
	for _, role := range db.roles {
		roles = append(roles, role.Role)
	}

	return roles, nil
}

func (db *identDB) GetUser(ctx context.Context, name string) (identity.User, error) {
	db.rw.RLock()
	defer db.rw.RUnlock()

	u, ok := db.users[strings.ToLower(name)]
	if !ok {
		return identity.User{}, httperr.NotFound("user", name).SetInternal(ErrNotFound)
	}

	return db.applyPrivacy(ctx, u), nil
}

func (db *identDB) GetRole(ctx context.Context, name string) (identity.Role, error) {
	db.rw.RLock()
	defer db.rw.RUnlock()

	g, ok := db.roles[strings.ToLower(name)]
	if !ok {
		return identity.Role{}, httperr.NotFound("role", name).SetInternal(ErrNotFound)
	}

	return g.Role, nil
}

func (db *identDB) GetUserPermissions(ctx context.Context, name string) ([]identity.Permission, error) {
	db.rw.RLock()
	defer db.rw.RUnlock()

	u, ok := db.users[strings.ToLower(name)]
	if !ok {
		return nil, httperr.NotFound("user", name).SetInternal(ErrNotFound)
	}

	perms := make([]identity.Permission, len(u.Permissions))
	for idx, p := range u.Permissions {
		perms[idx] = *p
	}

	return perms, nil
}

func (db *identDB) GetRolePermissions(ctx context.Context, name string) ([]identity.Permission, error) {
	db.rw.RLock()
	defer db.rw.RUnlock()

	g, ok := db.roles[strings.ToLower(name)]
	if !ok {
		return nil, httperr.NotFound("role", name).SetInternal(ErrNotFound)
	}

	perms := make([]identity.Permission, len(g.Permissions))
	for idx, p := range g.Permissions {
		perms[idx] = *p
	}

	return perms, nil
}

func (db *identDB) SetUserPassword(ctx context.Context, userName, password, algo string) error {
	hash, err := passwd.Hash(ctx, algo, password)
	if err != nil {
		return err
	}

	db.rw.Lock()
	defer db.rw.Unlock()

	user, ok := db.users[userName]
	if !ok {
		return httperr.NotFound("user", userName).SetInternal(ErrNotFound)
	}

	// create a shallow copy of u
	// so we don't modify u in place.
	var cu = *user
	user = &cu

	user.PasswordAlgo = algo
	user.PasswordHash = hash
	user.NeedsPasswordChange = false

	opts, err := conf.ConvertToFile(user, "")
	if err != nil {
		return err
	}

	// TODO(ppacher): we should actually reload the users once the property
	// changes.
	var defs []identity.UserPropertyDefinition
	if err := db.cfg.DecodeSection(ctx, "UserProperty", &defs); err != nil {
		return fmt.Errorf("failed to get user properties: %w", err)
	}

	// make sure we add all extra user-properties as well
	// as ConvertToFile will skip them.
	userSec := opts.Get("User")
	if userSec == nil {
		return fmt.Errorf("expected [User] section to exist")
	}
	for _, spec := range defs {
		val, ok := user.Properties[spec.Name]
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

	path := filepath.Join(db.dir, "identity", userName+".user")
	if err := renameio.WriteFile(path, buf.Bytes(), 0600); err != nil {
		return err
	}

	db.users[userName] = user

	return nil
}

func (db *identDB) applyPrivacy(ctx context.Context, u *UserModel) identity.User {
	schemaUser := u.User

	schemaUser.Properties = identity.FilterProperties(
		ctx,
		identity.GetScope(ctx),
		db.cfg,
		schemaUser.Properties,
	)

	// make sure only internal requests get access to password
	// data and avatar file names.
	if identity.GetScope(ctx) != identity.Internal {
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
	db.users = make(map[string]*UserModel, len(db.users))
	db.roles = make(map[string]*roleModel, len(db.roles))

	identityDir := filepath.Join(db.dir, "identity")

	// load all users files
	if err := db.loadUsers(ctx, identityDir); err != nil {
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
