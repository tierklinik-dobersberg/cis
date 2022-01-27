package mongo

import (
	"context"
	"fmt"

	"github.com/tierklinik-dobersberg/cis/internal/cfgspec"
	"github.com/tierklinik-dobersberg/cis/internal/identity"
	"github.com/tierklinik-dobersberg/cis/pkg/passwd"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

var log = pkglog.New("identity-provider-mongo")

type Provider struct {
	env identity.Environment

	users       *mongo.Collection
	roles       *mongo.Collection
	permissions *mongo.Collection
}

func New(ctx context.Context, env identity.Environment) (identity.Provider, error) {
	db := env.MongoClient.Database(env.MongoDatabaseName)
	return &Provider{
		env:         env,
		users:       db.Collection("identity:users"),
		roles:       db.Collection("identity:roles"),
		permissions: db.Collection("identity:permissions"),
	}, nil
}

func (p *Provider) Authenticate(ctx context.Context, name, password string) bool {
	log := log.From(ctx)

	usr, err := p.getUser(ctx, name)
	if err != nil {
		return false
	}
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
		result[idx] = p.applyPrivacy(ctx, &user{User: result[idx]})
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

func (p *Provider) getUser(ctx context.Context, name string) (*user, error) {
	r := p.users.FindOne(ctx, bson.M{
		"$name": name,
	})

	if r.Err() != nil {
		return nil, fmt.Errorf("failed to query: %w", r.Err())
	}

	var res user
	if err := r.Decode(&res); err != nil {
		return nil, fmt.Errorf("failed to decode: %w", err)
	}
	res.User = p.applyPrivacy(ctx, &res)
	return &res, nil
}

func (p *Provider) GetRole(ctx context.Context, name string) (cfgspec.Role, error) {
	r, err := p.getRole(ctx, name)
	if err != nil {
		return cfgspec.Role{}, err
	}
	return r.Role, nil
}

func (p *Provider) getRole(ctx context.Context, name string) (*role, error) {
	r := p.roles.FindOne(ctx, bson.M{
		"$name": name,
	})

	if r.Err() != nil {
		return nil, fmt.Errorf("failed to query: %w", r.Err())
	}

	var res role
	if err := r.Decode(&res); err != nil {
		return nil, fmt.Errorf("failed to decode: %w", err)
	}
	return &res, nil
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

func (p *Provider) SetUserPassword(ctx context.Context, name, password string) error {
	hash, err := passwd.Hash(ctx, "", password)
	if err != nil {
		return err
	}

	res, err := p.users.UpdateOne(ctx, bson.M{"$name": name}, bson.M{"$set": bson.M{
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

func (p *Provider) applyPrivacy(ctx context.Context, u *user) cfgspec.User {
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
