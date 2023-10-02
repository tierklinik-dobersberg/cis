package rosterapi

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/bufbuild/connect-go"
	"github.com/labstack/echo/v4"
	idmv1 "github.com/tierklinik-dobersberg/apis/gen/go/tkd/idm/v1"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/identity/providers/idm"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"google.golang.org/protobuf/types/known/fieldmaskpb"
)

type setOverwriteRequest struct {
	UserId      string    `json:"userId"`
	Phone       string    `json:"phoneNumber"`
	DisplayName string    `json:"displayName"`
	From        time.Time `json:"from"`
	To          time.Time `json:"to"`
}

// CreateOverwriteEndpoint allows to configure a duty roster overwrite.
func CreateOverwriteEndpoint(router *app.Router) {
	router.POST(
		"v1/overwrite",
		permission.OneOf{
			WriteRosterOverwriteAction,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			var body setOverwriteRequest
			if err := json.NewDecoder(c.Request().Body).Decode(&body); err != nil {
				return httperr.BadRequest(err)
			}

			if body.From.IsZero() {
				return httperr.InvalidField("from")
			}
			if body.To.IsZero() {
				return httperr.InvalidField("to")
			}

			if body.UserId != "" {
				user, err := app.IDM.UserServiceClient.GetUser(ctx, connect.NewRequest(&idmv1.GetUserRequest{
					Search: &idmv1.GetUserRequest_Id{
						Id: body.UserId,
					},
					FieldMask: &fieldmaskpb.FieldMask{
						Paths: []string{"profile.user.id", "profile.user.extra"},
					},
				}))
				if err != nil {
					return err
				}

				if idm.GetUserDisabled(user.Msg.Profile) {
					return httperr.BadRequest("user disabled")
				}
			}

			overwrite, err := app.OnCallOverwrites.CreateOverwrite(ctx, body.From, body.To, body.UserId, body.Phone, body.DisplayName)
			if err != nil {
				return err
			}

			return c.JSON(http.StatusOK, overwrite)
		},
	)
}
