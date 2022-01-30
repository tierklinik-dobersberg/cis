package mongo

import (
	"context"
	"fmt"

	"github.com/tierklinik-dobersberg/cis/internal/cfgspec"
	"github.com/tierklinik-dobersberg/cis/internal/identity"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/pkg/models/identity/v1alpha"
	"github.com/tierklinik-dobersberg/cis/pkg/passwd"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
	"go.mongodb.org/mongo-driver/bson"
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

	usr, err := p.getUser(ctx, name)
	if err != nil {
		return false
	}
	// FIXME(ppacher): should we check if the user is disable here already
	ok, err := passwd.Compare(ctx, usr.PasswordAlgo, name, usr.PasswordHash, password)
	if err != nil {
		log.Errorf("identity: failed to validate password for user %q: %s", name, err)
	}
	return ok
}

func (p *Provider) ListAllUsers(ctx context.Context) ([]cfgspec.User, error) {
	r, err := p.users.Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	if r.Err() != nil {
		return nil, r.Err()
	}

	var result []cfgspec.User
	if err := r.All(ctx, result); err != nil {
		return nil, err
	}
	for idx := range result {
		result[idx] = p.applyPrivacy(ctx, &UserModel{User: result[idx]})
	}
	return result, nil
}

func (p *Provider) GetUser(ctx context.Context, name string) (cfgspec.User, error) {
	usr, err := p.getUser(ctx, name)
	if err != nil {
		return cfgspec.User{}, err
	}
	return usr.User, nil
}

func (p *Provider) GetRole(ctx context.Context, name string) (cfgspec.Role, error) {
	r, err := p.getRole(ctx, name)
	if err != nil {
		return cfgspec.Role{}, err
	}
	return r.Role, nil
}

func (p *Provider) GetUserPermissions(ctx context.Context, name string) ([]cfgspec.Permission, error) {
	user, err := p.getUser(ctx, name)
	if err != nil {
		return nil, err
	}
	return user.Permissions, nil
}

func (p *Provider) GetRolePermissions(ctx context.Context, name string) ([]cfgspec.Permission, error) {
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
	if res.ModifiedCount != 1 {
		return fmt.Errorf("unexpected modify count %d", res.ModifiedCount)
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
		User: cfgspec.User{
			User:         u,
			PasswordHash: hash,
			PasswordAlgo: "bcrypt",
		},
	}

	// we do not check if the user already exists because the collection is expected
	// to have a unique-index on the username. This way mongo will automatically ensure
	// no other user has the same name.
	if _, err := p.users.InsertOne(ctx, record); err != nil {
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
	if res.ModifiedCount != 1 {
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
	if res.ModifiedCount != 1 {
		return httperr.NotFound("user", username)
	}
	return nil
}

func (p *Provider) AssignUserRole(ctx context.Context, user, role string) error {
	_, err := p.getRole(ctx, role)
	if err != nil {
		return err
	}

	res, err := p.users.UpdateOne(
		ctx,
		bson.M{"username": user},
		bson.M{"$addToSet": bson.M{
			"roles": role,
		}},
	)
	if err != nil {
		return err
	}
	if res.ModifiedCount != 1 {
		return httperr.NotFound("user", user)
	}
	return nil
}

func (p *Provider) UnassignUserRole(ctx context.Context, user, role string) error {
	res, err := p.users.UpdateOne(
		ctx,
		bson.M{"username": user},
		bson.M{"$pull": bson.M{
			"roles": role,
		}},
	)
	if err != nil {
		return err
	}
	if res.ModifiedCount != 1 {
		return httperr.NotFound("user", user)
	}
	return nil
}

// private methods
//

func (p *Provider) getUser(ctx context.Context, name string) (*UserModel, error) {
	r := p.users.FindOne(ctx, bson.M{
		"$name": name,
	})

	if r.Err() != nil {
		return nil, fmt.Errorf("failed to query: %w", r.Err())
	}

	var res UserModel
	if err := r.Decode(&res); err != nil {
		return nil, fmt.Errorf("failed to decode: %w", err)
	}
	res.User = p.applyPrivacy(ctx, &res)
	return &res, nil
}

func (p *Provider) getRole(ctx context.Context, name string) (*RoleModel, error) {
	r := p.roles.FindOne(ctx, bson.M{
		"$name": name,
	})

	if r.Err() != nil {
		return nil, fmt.Errorf("failed to query: %w", r.Err())
	}

	var res RoleModel
	if err := r.Decode(&res); err != nil {
		return nil, fmt.Errorf("failed to decode: %w", err)
	}
	return &res, nil
}

func (p *Provider) applyPrivacy(ctx context.Context, u *UserModel) cfgspec.User {
	schemaUser := u.User

	schemaUser.Properties = identity.FilterProperties(
		identity.GetScope(ctx),
		p.env.UserPropertyDefinitions,
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

// compile tim #äv ̇↑←e checks for identity provider features
var (
	_ identity.Provider              = new(Provider)
	_ identity.PasswortChangeSupport = new(Provider)
	_ identity.ManageUserSupport     = new(Provider)
)
