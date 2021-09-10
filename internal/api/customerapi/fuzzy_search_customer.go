package customerapi

import (
	"context"
	"net/http"
	"strconv"

	"github.com/antzucaro/matchr"
	"github.com/gin-gonic/gin"
	"github.com/nyaruka/phonenumbers"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/cfgspec"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	v1 "github.com/tierklinik-dobersberg/cis/pkg/models/customer/v1alpha"
	"github.com/tierklinik-dobersberg/cis/pkg/models/identity/v1alpha"
	"github.com/tierklinik-dobersberg/logger"
	"go.mongodb.org/mongo-driver/bson"
)

// FuzzySearchEndpoint allows searching for customers using
// a double metaphone driven search on the customers name.
func FuzzySearchEndpoint(grp *app.Router) {
	grp.GET(
		"v1/",
		permission.OneOf{
			ReadCustomerAction,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			filter := bson.M{}
			singleResponse := c.Query("single") != ""

			// get a list of all users if we should also include
			// users into the result.
			_, includeUsers := c.GetQuery("includeUsers")
			if includeUsers && singleResponse {
				return httperr.BadRequest(nil, "cannot mix query parameters single and includeUsers")
			}

			var allUsers []cfgspec.User
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

			matchedUsers := make(map[string]v1alpha.User)
			if name := c.Query("name"); name != "" {
				m1, m2 := matchr.DoubleMetaphone(name)
				filter["$text"] = bson.M{
					"$search":   m1 + " " + m2,
					"$language": "de",
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

			if phoneQueries, ok := c.GetQueryArray("phone"); ok && len(phoneQueries) > 0 {
				phoneNumbers := []string{}
				for _, phone := range phoneQueries {
					// skip empty phone numbers and "anonymous".
					if phone == "" || phone == "anonymous" {
						continue
					}
					logger.From(ctx).V(7).Logf("parsing phone number from query: %q", phone)
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
					phoneToUser := make(map[string]cfgspec.User)
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
						logger.From(ctx).V(7).Logf("searching for user with phone number %s", p)
						if u, ok := phoneToUser[p]; ok {
							matchedUsers[u.Name] = u.User
						}
					}
				}

				filter["phoneNumbers"] = bson.M{
					"$in": phoneNumbers,
				}
			}

			if city := c.Query("city"); city != "" {
				filter["city"] = city
			}

			if cityCode := c.Query("cityCode"); cityCode != "" {
				parsed, err := strconv.ParseInt(cityCode, 10, 0)
				if err != nil {
					return httperr.InvalidParameter("cityCode")
				}

				filter["cityCode"] = parsed
			}

			if mail := c.Query("mail"); mail != "" {
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

			customers, err := app.Customers.FilterCustomer(ctx, filter)
			if err != nil {
				return err
			}

			if singleResponse {
				if len(customers) == 0 {
					return httperr.NotFound("customer", "filter", nil)
				}

				c.JSON(http.StatusOK, CustomerModel(ctx, customers[0]))
				return nil
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
						CustomerID:    -1,
					})
				}
			}

			for _, cu := range customers {
				m := CustomerModel(ctx, cu)
				models = append(models, m)
			}

			c.JSON(http.StatusOK, models)
			return nil
		},
	)
}
