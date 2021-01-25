package externalapi

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/nyaruka/phonenumbers"
	"github.com/tierklinik-dobersberg/cis/internal/api/customerapi"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/httperr"
	"github.com/tierklinik-dobersberg/cis/pkg/models/customer/v1alpha"
	"go.mongodb.org/mongo-driver/bson"
)

type ContactResponse struct {
	*v1alpha.Customer

	Contact map[string]interface{} `json:"contact"`
}

func GetContactEndpoint(grp *app.Router) {
	grp.GET(
		"v1/contact",
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			phone := c.Query("phone")
			if phone == "" {
				return httperr.BadRequest(nil, "missing query parameter phone")
			}

			number, err := phonenumbers.Parse(phone, app.Config.Country)
			if err != nil {
				return httperr.BadRequest(err, "Invalid phone number")
			}

			filter := bson.M{
				"phoneNumbers": bson.M{
					"$in": []string{
						phonenumbers.Format(number, phonenumbers.NATIONAL),
						phonenumbers.Format(number, phonenumbers.INTERNATIONAL),
					},
				},
			}

			customers, err := app.Customers.FilterCustomer(ctx, filter)
			if err != nil {
				return err
			}

			if len(customers) == 0 {
				return httperr.NotFound("customer", phone, nil)
			}

			if len(customers) > 1 {
				return httperr.WithCode(http.StatusMultipleChoices, errors.New("to many matches for "+phone))
			}

			response := ContactResponse{
				Customer: customerapi.CustomerModel(ctx, customers[0]),
				Contact:  make(map[string]interface{}),
			}

			for idx, phone := range response.PhoneNumbers {
				response.Contact[fmt.Sprintf("phone%d", idx+1)] = strings.ReplaceAll(phone, " ", "")
			}

			c.JSON(http.StatusOK, response)

			return nil
		},
	)
}
