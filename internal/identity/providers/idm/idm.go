package idm

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/bufbuild/connect-go"
	idmv1 "github.com/tierklinik-dobersberg/apis/gen/go/tkd/idm/v1"
	"github.com/tierklinik-dobersberg/apis/gen/go/tkd/idm/v1/idmv1connect"
	"github.com/tierklinik-dobersberg/cis/internal/identity"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/pkg/models/identity/v1alpha"
	"google.golang.org/protobuf/types/known/fieldmaskpb"
	"google.golang.org/protobuf/types/known/structpb"
)

type Provider struct {
	idmv1connect.AuthServiceClient
	idmv1connect.UserServiceClient
	idmv1connect.RoleServiceClient
	idmv1connect.SelfServiceServiceClient
}

func New(baseURL string, httpClient *http.Client) *Provider {
	if httpClient == nil {
		httpClient = http.DefaultClient
	}

	return &Provider{
		AuthServiceClient:        idmv1connect.NewAuthServiceClient(httpClient, baseURL),
		UserServiceClient:        idmv1connect.NewUserServiceClient(httpClient, baseURL),
		RoleServiceClient:        idmv1connect.NewRoleServiceClient(httpClient, baseURL),
		SelfServiceServiceClient: idmv1connect.NewSelfServiceServiceClient(httpClient, baseURL),
	}
}

func GetUserCalendarId(profile *idmv1.Profile) string {
	if extrapb := profile.User.GetExtra(); extrapb != nil {
		calID, ok := extrapb.Fields["calendarId"]
		if !ok {
			return ""
		}

		switch v := calID.Kind.(type) {
		case *structpb.Value_StringValue:
			return v.StringValue
		default:
			// FIXME(ppacher): log incorrect calendarId value type
		}
	}
	return ""
}

func GetUserDisabled(profile *idmv1.Profile) bool {
	if extrapb := profile.User.GetExtra(); extrapb != nil {
		disabledProp, ok := extrapb.Fields["disabled"]
		if ok {
			switch v := disabledProp.Kind.(type) {
			case *structpb.Value_BoolValue:
				return v.BoolValue
			default:
			}
		}
	}
	return false
}

func errFrom(err error) error {
	var cerr *connect.Error
	if errors.As(err, &cerr) {
		switch cerr.Code() {
		case connect.CodeNotFound:
			return httperr.NotFound("", cerr.Message()).SetInternal(err)
		}
	}

	return httperr.InternalError().SetInternal(err)
}

func protoToUser(profile *idmv1.Profile) identity.User {
	fullname := fmt.Sprintf("%s %s", profile.User.FirstName, profile.User.LastName)
	fullname = strings.TrimPrefix(fullname, " ")
	fullname = strings.TrimSuffix(fullname, " ")

	usr := identity.User{
		User: v1alpha.User{
			Name:     profile.User.Username,
			Fullname: fullname,
		},
	}

	for _, p := range profile.EmailAddresses {
		usr.User.Mail = append(usr.User.Mail, p.Address)
	}

	for _, p := range profile.PhoneNumbers {
		usr.User.PhoneNumber = append(usr.User.PhoneNumber, p.Number)
	}

	usr.User.Properties = make(map[string]any)

	if extrapb := profile.User.GetExtra(); extrapb != nil {
		m := extrapb.AsMap()

		if calendarID, ok := m["calendarId"].(string); ok {
			usr.User.CalendarID = calendarID
		}

		if disabled, ok := m["disabled"].(bool); ok {
			usr.User.Disabled = &disabled
		}

		if color, ok := m["color"].(string); ok {
			usr.User.Color = color
		}

		usr.User.Properties = m
	}

	// store the user id in the user properties
	usr.User.Properties["id"] = profile.User.Id

	return usr
}

// Deprecated
func (p *Provider) Authenticate(ctx context.Context, name, password string) bool {
	return false
}

func (p *Provider) ListAllUsers(ctx context.Context) ([]identity.User, error) {
	resp, err := p.UserServiceClient.ListUsers(ctx, connect.NewRequest(&idmv1.ListUsersRequest{}))
	if err != nil {
		return nil, err
	}

	users := make([]identity.User, len(resp.Msg.Users))
	for idx, usr := range resp.Msg.Users {
		users[idx] = protoToUser(usr)
	}

	return users, nil
}

func (p *Provider) GetUser(ctx context.Context, name string) (identity.User, error) {
	resp, err := p.UserServiceClient.GetUser(ctx, connect.NewRequest(&idmv1.GetUserRequest{
		Search: &idmv1.GetUserRequest_Name{
			Name: name,
		},
	}))

	if err != nil {
		return identity.User{}, errFrom(err)
	}

	user := protoToUser(resp.Msg.Profile)

	return user, nil
}

func (p *Provider) ListRoles(ctx context.Context) ([]identity.Role, error) {
	resp, err := p.RoleServiceClient.ListRoles(ctx, connect.NewRequest(&idmv1.ListRolesRequest{}))
	if err != nil {
		return nil, errFrom(err)
	}

	roles := make([]identity.Role, len(resp.Msg.Roles))
	for idx, r := range resp.Msg.Roles {
		roles[idx] = identity.Role{
			Role: v1alpha.Role{
				Name:        r.Name,
				Description: r.Description,
			},
		}
	}

	return roles, nil
}

func (p *Provider) GetRole(ctx context.Context, name string) (identity.Role, error) {
	resp, err := p.RoleServiceClient.GetRole(ctx, connect.NewRequest(&idmv1.GetRoleRequest{
		Search: &idmv1.GetRoleRequest_Name{
			Name: name,
		},
	}))

	if err != nil {
		return identity.Role{}, errFrom(err)
	}

	return identity.Role{
		Role: v1alpha.Role{
			Name:        resp.Msg.Role.Name,
			Description: resp.Msg.Role.Description,
		},
	}, nil
}

func (p *Provider) CreateUser(ctx context.Context, user v1alpha.User, password string) error {
	nameParts := strings.Split(user.Fullname, " ")
	firstname := ""
	lastname := ""

	if len(nameParts) == 1 {
		lastname = nameParts[0]
	}
	if len(nameParts) == 2 {
		firstname = nameParts[1]
	}

	extra := map[string]any{
		"calendarId": user.CalendarID,
		"disabled":   user.Disabled,
		"color":      user.Color,
	}

	for key, val := range user.Properties {
		extra[key] = val
	}

	extrapb, err := structpb.NewStruct(extra)
	if err != nil {
		return err
	}

	mails := make([]*idmv1.EMail, len(user.Mail))
	for idx, m := range user.Mail {
		mails[idx] = &idmv1.EMail{
			Address:  m,
			Verified: true,
			Primary:  idx == 0,
		}
	}

	phone := make([]*idmv1.PhoneNumber, len(user.PhoneNumber))
	for idx, p := range user.PhoneNumber {
		phone[idx] = &idmv1.PhoneNumber{
			Number:   p,
			Verified: true,
			Primary:  idx == 0,
		}
	}

	_, err = p.UserServiceClient.CreateUser(ctx, connect.NewRequest(&idmv1.CreateUserRequest{
		Password: password,
		Profile: &idmv1.Profile{
			User: &idmv1.User{
				Id:          user.Name,
				Username:    user.Name,
				DisplayName: user.Name,
				LastName:    lastname,
				FirstName:   firstname,
				Extra:       extrapb,
			},
			EmailAddresses: mails,
			PhoneNumbers:   phone,
		},
	}))
	if err != nil {
		return errFrom(err)
	}

	return nil
}

func (p *Provider) EditUser(context.Context, string, v1alpha.User) error {
	return fmt.Errorf("not yet implemented")
}

func (p *Provider) DisableUser(ctx context.Context, username string) error {
	user, err := p.GetUser(ctx, username)
	if err != nil {
		return err
	}

	extrapb, err := structpb.NewStruct(map[string]any{
		"disabled": true,
	})
	if err != nil {
		return err
	}

	_, err = p.UserServiceClient.UpdateUser(ctx, connect.NewRequest(&idmv1.UpdateUserRequest{
		Id:    user.Properties["id"].(string),
		Extra: extrapb,
		FieldMask: &fieldmaskpb.FieldMask{
			Paths: []string{"extra.disabled"},
		},
	}))
	if err != nil {
		return errFrom(err)
	}

	return nil
}

func (p *Provider) AssignUserRole(ctx context.Context, username, rolename string) error {
	user, err := p.GetUser(ctx, username)
	if err != nil {
		return err
	}

	role, err := p.getRoleProto(ctx, rolename)
	if err != nil {
		return err
	}

	_, err = p.RoleServiceClient.AssignRoleToUser(ctx, connect.NewRequest(&idmv1.AssignRoleToUserRequest{
		RoleId: role.Id,
		UserId: []string{user.Properties["id"].(string)},
	}))
	if err != nil {
		return errFrom(err)
	}

	return nil
}

func (p *Provider) UnassignUserRole(ctx context.Context, username, rolename string) error {
	user, err := p.GetUser(ctx, username)
	if err != nil {
		return err
	}

	role, err := p.getRoleProto(ctx, rolename)
	if err != nil {
		return err
	}

	_, err = p.RoleServiceClient.UnassignRoleFromUser(ctx, connect.NewRequest(&idmv1.UnassignRoleFromUserRequest{
		RoleId: role.Id,
		UserId: []string{user.Properties["id"].(string)},
	}))
	if err != nil {
		return errFrom(err)
	}

	return nil
}

func (p *Provider) CreateRole(ctx context.Context, role v1alpha.Role) error {
	_, err := p.RoleServiceClient.CreateRole(ctx, connect.NewRequest(&idmv1.CreateRoleRequest{
		Name:        role.Name,
		Description: role.Description,
	}))
	if err != nil {
		return errFrom(err)
	}

	return nil
}

func (p *Provider) EditRole(ctx context.Context, oldName string, role v1alpha.Role) error {
	getRoleResp, err := p.getRoleProto(ctx, oldName)
	if err != nil {
		return err
	}

	_, err = p.RoleServiceClient.UpdateRole(ctx, connect.NewRequest(&idmv1.UpdateRoleRequest{
		RoleId:      getRoleResp.Id,
		Name:        role.Name,
		Description: role.Description,
		FieldMask: &fieldmaskpb.FieldMask{
			Paths: []string{"name", "description"},
		},
	}))
	if err != nil {
		return errFrom(err)
	}

	return nil
}

func (p *Provider) getRoleProto(ctx context.Context, roleName string) (*idmv1.Role, error) {
	getRoleResp, err := p.RoleServiceClient.GetRole(ctx, connect.NewRequest(&idmv1.GetRoleRequest{
		Search: &idmv1.GetRoleRequest_Name{
			Name: roleName,
		},
	}))
	if err != nil {
		return nil, errFrom(err)
	}

	return getRoleResp.Msg.Role, nil
}

func (p *Provider) DeleteRole(ctx context.Context, roleName string) error {
	role, err := p.getRoleProto(ctx, roleName)
	if err != nil {
		return err
	}

	_, err = p.RoleServiceClient.DeleteRole(ctx, connect.NewRequest(&idmv1.DeleteRoleRequest{
		RoleId: role.Id,
	}))
	if err != nil {
		return errFrom(err)
	}

	return nil
}

func (p *Provider) CreatePermission(context.Context, string, string, identity.Permission) (string, error) {
	return "", fmt.Errorf("not implemented")
}

func (p *Provider) DeletePermission(context.Context, string, string, string) error {
	return fmt.Errorf("not implemented")
}

// Deprecated
func (p *Provider) GetUserPermissions(context.Context, string) ([]identity.Permission, error) {
	return []identity.Permission{
		{
			Permission: v1alpha.Permission{
				ID:        "fake",
				Resources: []string{".*"},
				Effect:    "allow",
				Actions:   []string{".*"},
			},
		},
	}, nil
}

// Deprecated
func (p *Provider) GetRolePermissions(context.Context, string) ([]identity.Permission, error) {
	return []identity.Permission{
		{
			Permission: v1alpha.Permission{
				ID:        "fake",
				Resources: []string{".*"},
				Effect:    "allow",
				Actions:   []string{".*"},
			},
		},
	}, nil
}

var _ identity.Provider = (*Provider)(nil)
var _ identity.ManageUserSupport = (*Provider)(nil)
