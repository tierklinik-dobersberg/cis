package customerapi

import (
	"context"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/nyaruka/phonenumbers"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/identity"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	v1 "github.com/tierklinik-dobersberg/cis/pkg/models/customer/v1alpha"
	"github.com/tierklinik-dobersberg/cis/pkg/models/identity/v1alpha"
	"github.com/tierklinik-dobersberg/logger"
	"go.mongodb.org/mongo-driver/bson"
)

// FuzzySearchEndpoint allows searching for customers using
// a double metaphone driven search on the customers name.
// trunk-ignore(golangci-lint/gocognit)
func FuzzySearchEndpoint(grp *app.Router) {
	grp.GET(
		"v1",
		permission.OneOf{
			ReadCustomerAction,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			filter := bson.M{}
			singleResponse := c.QueryParam("single") != ""

			// get a list of all users if we should also include
			// users into the result.
			includeUsers := c.QueryParams().Has("includeUsers")
			if includeUsers && singleResponse {
				return httperr.BadRequest("cannot mix query parameters single and includeUsers")
			}

			var allUsers []identity.User
			if includeUsers {
				var err error
				allUsers, err = app.Identities.ListAllUsers(ctx)
				if err != nil {
					logger.From(ctx).Errorf("failed to load all users: %s", err)
					// we only log the error here because we still want to
					// search the customer database ...
				} else {
					logger.From(ctx).V(6).Logf("'includeUsers' enabled, loaded %d identities", len(allUsers))
				}
			}

			textScore := false
			matchedUsers := make(map[string]v1alpha.User)
			if name := c.QueryParam("name"); name != "" {
				textScore = true
				// m1, m2 := matchr.DoubleMetaphone(name)
				filter["$text"] = bson.M{
					"$search": name,
				}

				if includeUsers {
					for _, u := range allUsers {
						// TODO(ppacher): maybe search by doublemetaphone as well?
						if u.Name == name || u.Fullname == name {
							matchedUsers[u.Name] = u.User
						}
					}
				}
			}

			// trunk-ignore(golangci-lint/nestif)
			if phoneQueries, ok := c.QueryParams()["phone"]; ok && len(phoneQueries) > 0 {
				phoneNumbers := []string{}
				for _, phone := range phoneQueries {
					// skip empty phone numbers and "anonymous".
					if phone == "" || phone == "anonymous" {
						continue
					}
					number, err := phonenumbers.Parse(phone, app.Config.Country)
					if err != nil {
						return httperr.InvalidParameter("phone", phone)
					}
					phoneNumbers = append(phoneNumbers, phonenumbers.Format(number, phonenumbers.NATIONAL))
					phoneNumbers = append(phoneNumbers, phonenumbers.Format(number, phonenumbers.INTERNATIONAL))
				}

				// if includeUsers is specified as a query parameter than
				// we also try to search for users that have the given
				// phone numbers.
				if includeUsers {
					// build a lookup map for phone -> user
					phoneToUser := make(map[string]identity.User)
					for _, u := range allUsers {
						for _, p := range u.PhoneNumber {
							number, err := phonenumbers.Parse(p, app.Config.Country)
							if err != nil {
								logger.From(ctx).Errorf("failed to parse phone number from user %s: %s", u.Name, err)

								continue
							}
							international := phonenumbers.Format(number, phonenumbers.INTERNATIONAL)
							phoneToUser[international] = u
							logger.From(ctx).V(7).Logf("adding %s with phone number %s", u.Name, international)
						}
					}

					logger.From(ctx).V(7).Logf("built lookup map for user phone numbers (size=%d)", len(phoneToUser))
					for _, p := range phoneNumbers {
						if u, ok := phoneToUser[p]; ok {
							matchedUsers[u.Name] = u.User
						}
					}
				}

				filter["phoneNumbers"] = bson.M{
					"$in": phoneNumbers,
				}
			}

			if city := c.QueryParam("city"); city != "" {
				filter["city"] = city
			}

			if cityCode := c.QueryParam("cityCode"); cityCode != "" {
				parsed, err := strconv.ParseInt(cityCode, 10, 0)
				if err != nil {
					return httperr.InvalidParameter("cityCode", err.Error())
				}

				filter["cityCode"] = parsed
			}

			if mail := c.QueryParam("mail"); mail != "" {
				filter["mailAddresses"] = mail

				// search users by mail address
				if includeUsers {
				L:
					for _, u := range allUsers {
						for _, m := range u.Mail {
							if m == mail {
								matchedUsers[u.Name] = u.User

								continue L
							}
						}
					}
				}
			}

			customers, err := app.Customers.FilterCustomer(ctx, filter, textScore)
			if err != nil {
				return err
			}

			if singleResponse {
				if len(customers) == 0 {
					return httperr.NotFound("customer", "filter")
				}

				return c.JSON(http.StatusOK, CustomerModel(ctx, customers[0]))
			}

			models := make([]*v1.Customer, 0, len(customers))
			if includeUsers {
				logger.From(ctx).Infof("includeUsers: found %d matching users", len(matchedUsers))
				for _, u := range matchedUsers {
					models = append(models, &v1.Customer{
						ID:            u.Name,
						Source:        "__identities",
						Group:         "Users",
						Name:          u.Fullname,
						PhoneNumbers:  u.PhoneNumber,
						MailAddresses: u.Mail,
						CustomerID:    "-1",
					})
				}
			}

			for _, cu := range customers {
				m := CustomerModel(ctx, cu)
				models = append(models, m)
			}

			return c.JSON(http.StatusOK, models)
		},
	)
}
