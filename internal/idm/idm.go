package idm

import (
	"errors"
	"net/http"

	"github.com/bufbuild/connect-go"
	idmv1 "github.com/tierklinik-dobersberg/apis/gen/go/tkd/idm/v1"
	"github.com/tierklinik-dobersberg/apis/gen/go/tkd/idm/v1/idmv1connect"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
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
