package externalapi

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/nyaruka/phonenumbers"
	"github.com/tierklinik-dobersberg/cis/internal/api/customerapi"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
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
		func(ctx context.Context, app *app.App, c echo.Context) error {
			phone := c.QueryParam("phone")
			if phone == "" {
				return httperr.MissingParameter("phone")
			}

			number, err := phonenumbers.Parse(phone, app.Config.Country)
			if err != nil {
				return httperr.InvalidParameter("phone", err.Error())
			}

			filter := bson.M{
				"phoneNumbers": bson.M{
					"$in": []string{
						phonenumbers.Format(number, phonenumbers.NATIONAL),
						phonenumbers.Format(number, phonenumbers.INTERNATIONAL),
					},
				},
			}

			customers, err := app.Customers.FilterCustomer(ctx, filter, false)
			if err != nil {
				return err
			}

			if len(customers) == 0 {
				// If there's a UnknownContactName configured we do reply with a
				// fake contact rather can sending NotFound.
				if app.Config.UnknownContactName != "" {
					contact := ContactResponse{
						Customer: &v1alpha.Customer{
							CustomerID: app.Config.UnknownContactID,
							Source:     app.Config.UnknownContactSource,
							Name:       app.Config.UnknownContactName,
						},
						Contact: map[string]interface{}{
							"phone1": strings.ReplaceAll(phonenumbers.Format(number, phonenumbers.NATIONAL), " ", ""),
							"phone2": strings.ReplaceAll(phonenumbers.Format(number, phonenumbers.INTERNATIONAL), " ", ""),
						},
					}
					if contact.Name == "${caller}" {
						contact.Name = phone
					}

					log.From(ctx).Infof("returning unknown customer (%s/%d): %s for %q", contact.Source, contact.CustomerID, contact.Name, phone)

					return c.JSON(http.StatusOK, contact)
				}

				return httperr.NotFound("customer", phone)
			}

			/*
				TODO(ppacher): re-enable the multiple-results case but make sure
				we handle contact merging correctly before.
			*/
			if len(customers) > 1 {
				// return httperr.WithCode(http.StatusMultipleChoices, errors.New("to many matches for "+phone))
				log.From(ctx).Errorf("multiple (%d) results found for %s", len(customers), phone)
			}

			response := ContactResponse{
				Customer: customerapi.CustomerModel(ctx, customers[0]),
				Contact:  make(map[string]interface{}),
			}

			for idx, phone := range response.PhoneNumbers {
				response.Contact[fmt.Sprintf("phone%d", idx+1)] = strings.ReplaceAll(phone, " ", "")
			}

			return c.JSON(http.StatusOK, response)
		},
	)
}
