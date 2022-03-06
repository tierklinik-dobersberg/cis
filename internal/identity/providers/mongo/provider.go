package mongo

import (
	"context"
	"errors"
	"fmt"

	"github.com/tierklinik-dobersberg/cis/internal/identity"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/pkg/models/identity/v1alpha"
	"github.com/tierklinik-dobersberg/cis/pkg/passwd"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

var log = pkglog.New("identity-provider-mongo")

type Provider struct {
	env identity.Environment

	users *mongo.Collection
	roles *mongo.Collection
}

const (
	UserCollection = "identity:users"
	RoleCollection = "identity:roles"
)

func New(ctx context.Context, env identity.Environment) (identity.Provider, error) {
	db := env.MongoClient.Database(env.MongoDatabaseName)

	return &Provider{
		env:   env,
		users: db.Collection(UserCollection),
		roles: db.Collection(RoleCollection),
	}, nil
}

// identity.Provider interface
//

func (p *Provider) Authenticate(ctx context.Context, name, password string) bool {
	log := log.From(ctx)

	ctx = identity.WithScope(ctx, identity.Internal)
	usr, err := p.getUser(ctx, name)
	if err != nil {
		log.V(7).Logf("failed to load user with name %q: %s", name, err)

		return false
	}

	if usr.Disabled != nil && *usr.Disabled {
		log.Infof("identity: user %s is disabled. Authentication denied", name)

		return false
	}

	ok, err := passwd.Compare(ctx, usr.PasswordAlgo, usr.PasswordHash, password)
	if err != nil {
		log.Errorf("identity: failed to validate password for user %q: %s", name, err)
	}

	return ok
}

func (p *Provider) ListAllUsers(ctx context.Context) ([]identity.User, error) {
	r, err := p.users.Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	if r.Err() != nil {
		return nil, r.Err()
	}

	var result []identity.User
	if err := r.All(ctx, &result); err != nil {
		return nil, err
	}
	for idx := range result {
		result[idx] = p.applyPrivacy(ctx, &UserModel{User: result[idx]})
	}

	return result, nil
}

func (p *Provider) ListRoles(ctx context.Context) ([]identity.Role, error) {
	r, err := p.roles.Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	if r.Err() != nil {
		return nil, r.Err()
	}

	var result []identity.Role
	if err := r.All(ctx, &result); err != nil {
		return nil, err
	}

	return result, nil
}

func (p *Provider) GetUser(ctx context.Context, name string) (identity.User, error) {
	usr, err := p.getUser(ctx, name)
	if err != nil {
		return identity.User{}, err
	}

	return usr.User, nil
}

func (p *Provider) GetRole(ctx context.Context, name string) (identity.Role, error) {
	r, err := p.getRole(ctx, name)
	if err != nil {
		return identity.Role{}, err
	}

	return r.Role, nil
}

func (p *Provider) GetUserPermissions(ctx context.Context, name string) ([]identity.Permission, error) {
	user, err := p.getUser(ctx, name)
	if err != nil {
		return nil, err
	}

	return user.Permissions, nil
}

func (p *Provider) GetRolePermissions(ctx context.Context, name string) ([]identity.Permission, error) {
	role, err := p.getRole(ctx, name)
	if err != nil {
		return nil, err
	}

	return role.Permissions, nil
}

// identity.ChangePasswordSupport interface
//

func (p *Provider) SetUserPassword(ctx context.Context, name, password, algo string) error {
	hash, err := passwd.Hash(ctx, "", password)
	if err != nil {
		return err
	}

	res, err := p.users.UpdateOne(ctx, bson.M{"name": name}, bson.M{"$set": bson.M{
		"passwordHash": hash,
	}})
	if err != nil {
		return err
	}
	if res.MatchedCount != 1 {
		return fmt.Errorf("unexpected modify count %d", res.MatchedCount)
	}

	return nil
}

// identity.ManageUserSupport interface
//

func (p *Provider) CreateUser(ctx context.Context, u v1alpha.User, password string) error {
	hash, err := passwd.Hash(ctx, "bcrypt", password)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	record := UserModel{
		User: identity.User{
			User:         u,
			PasswordHash: hash,
			PasswordAlgo: "bcrypt",
		},
	}

	// we do not check if the user already exists because the collection is expected
	// to have a unique-index on the username. This way mongo will automatically ensure
	// no other user has the same name.
	if _, err := p.users.InsertOne(ctx, record); err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return httperr.PreconditionFailed("user name already used").SetInternal(err)
		}

		return err
	}

	return nil
}

func (p *Provider) EditUser(ctx context.Context, username string, user v1alpha.User) error {
	// NOTE(ppacher): we currently rely on ",omitempty" being set for all user fields.
	// 		          this way mongo will not try to update the properties when used
	//                in a $set operation.

	// make sure we don't try to change the username
	user.Name = ""

	res, err := p.users.UpdateOne(
		ctx,
		bson.M{"name": username},
		bson.M{"$set": user},
	)
	if err != nil {
		return err
	}
	if res.MatchedCount != 1 {
		return httperr.NotFound("user", username)
	}

	return nil
}

func (p *Provider) DisableUser(ctx context.Context, username string) error {
	res, err := p.users.UpdateOne(
		ctx,
		bson.M{"name": username},
		bson.M{"$set": bson.M{
			"disabled": true,
		}},
	)
	if err != nil {
		return err
	}
	if res.MatchedCount != 1 {
		return httperr.NotFound("user", username)
	}

	return nil
}

func (p *Provider) AssignUserRole(ctx context.Context, user, role string) error {
	if _, err := p.getRole(ctx, role); err != nil {
		return err
	}

	res, err := p.users.UpdateOne(
		ctx,
		bson.M{"name": user},
		bson.M{"$addToSet": bson.M{
			"roles": role,
		}},
	)
	if err != nil {
		return err
	}
	if res.MatchedCount != 1 {
		return httperr.NotFound("user", user)
	}

	return nil
}

func (p *Provider) UnassignUserRole(ctx context.Context, user, role string) error {
	res, err := p.users.UpdateOne(
		ctx,
		bson.M{"name": user},
		bson.M{"$pull": bson.M{
			"roles": role,
		}},
	)
	if err != nil {
		return err
	}
	if res.MatchedCount != 1 {
		return httperr.NotFound("user", user)
	}

	return nil
}

func (p *Provider) CreateRole(ctx context.Context, role v1alpha.Role) error {
	record := RoleModel{
		Role: identity.Role{
			Role: role,
		},
		Permissions: nil,
	}
	_, err := p.roles.InsertOne(ctx, record)
	if err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return httperr.PreconditionFailed("role name already used").SetInternal(err)
		}

		return err
	}

	return nil
}

func (p *Provider) EditRole(ctx context.Context, oldRoleName string, role v1alpha.Role) error {
	record := RoleModel{
		Role: identity.Role{
			Role: role,
		},
	}
	upd, err := p.roles.UpdateOne(ctx, bson.M{"name": oldRoleName}, bson.M{"$set": record})
	if err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return httperr.PreconditionFailed("role name already used").SetInternal(err)
		}

		return err
	}
	if upd.MatchedCount != 1 {
		return httperr.NotFound("role", oldRoleName)
	}

	return nil
}

func (p *Provider) DeleteRole(ctx context.Context, roleName string) error {
	if _, err := p.users.UpdateMany(
		ctx,
		bson.M{},
		bson.M{"$pull": bson.M{
			"roles": roleName,
		}},
	); err != nil {
		return fmt.Errorf("failed to unassign role from all users: %w", err)
	}

	res, err := p.roles.DeleteOne(ctx, bson.M{"name": roleName})
	if err != nil {
		return err
	}
	if res.DeletedCount != 1 {
		return httperr.NotFound("role", roleName)
	}

	return nil
}

func (p *Provider) CreatePermission(ctx context.Context, scope, owner string, perm identity.Permission) (string, error) {
	perm.ID = primitive.NewObjectID().Hex()

	var col *mongo.Collection
	switch scope {
	case "users":
		col = p.users
	case "roles":
		col = p.roles
	default:
		return "", httperr.BadRequest().SetInternal(
			fmt.Errorf("invalid permission scope %q", scope),
		)
	}

	res, err := col.UpdateOne(ctx, bson.M{"name": owner}, bson.M{
		"$push": bson.M{
			"permissions": perm,
		},
	})
	if err != nil {
		return "", err
	}
	if res.MatchedCount != 1 {
		return "", httperr.NotFound(scope, owner)
	}

	return perm.ID, nil
}

func (p *Provider) DeletePermission(ctx context.Context, scope, owner, permID string) error {
	var col *mongo.Collection
	switch scope {
	case "users":
		col = p.users
	case "roles":
		col = p.roles
	default:
		return httperr.BadRequest().SetInternal(
			fmt.Errorf("invalid permission scope %q", scope),
		)
	}

	res, err := col.UpdateOne(ctx, bson.M{"name": owner}, bson.M{
		"$pull": bson.M{
			"permissions": bson.M{
				"id": permID,
			},
		},
	})
	if err != nil {
		return err
	}
	if res.MatchedCount != 1 {
		return httperr.NotFound(scope, owner)
	}

	return nil
}

// private methods
//

func (p *Provider) getUser(ctx context.Context, name string) (*UserModel, error) {
	queryResult := p.users.FindOne(ctx, bson.M{
		"name": name,
	})

	if queryResult.Err() != nil {
		if errors.Is(queryResult.Err(), mongo.ErrNoDocuments) {
			return nil, httperr.NotFound("user", name).SetInternal(queryResult.Err())
		}

		return nil, fmt.Errorf("failed to query: %w", queryResult.Err())
	}

	var res UserModel
	if err := queryResult.Decode(&res); err != nil {
		return nil, fmt.Errorf("failed to decode: %w", err)
	}
	res.User = p.applyPrivacy(ctx, &res)

	return &res, nil
}

func (p *Provider) getRole(ctx context.Context, name string) (*RoleModel, error) {
	queryResult := p.roles.FindOne(ctx, bson.M{
		"name": name,
	})

	if queryResult.Err() != nil {
		if errors.Is(queryResult.Err(), mongo.ErrNoDocuments) {
			return nil, httperr.NotFound("role", name).SetInternal(queryResult.Err())
		}

		return nil, fmt.Errorf("failed to query: %w", queryResult.Err())
	}

	var res RoleModel
	if err := queryResult.Decode(&res); err != nil {
		return nil, fmt.Errorf("failed to decode: %w", err)
	}

	return &res, nil
}

func (p *Provider) applyPrivacy(ctx context.Context, u *UserModel) identity.User {
	schemaUser := u.User

	schemaUser.Properties = identity.FilterProperties(
		ctx,
		identity.GetScope(ctx),
		p.env.ConfigSchema,
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

// compile time checks for identity provider features.
var (
	_ identity.Provider              = new(Provider)
	_ identity.PasswortChangeSupport = new(Provider)
	_ identity.ManageUserSupport     = new(Provider)
)
