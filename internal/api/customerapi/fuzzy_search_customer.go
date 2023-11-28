package customerapi

import (
	"context"
	"net/http"
	"strconv"

	"github.com/bufbuild/connect-go"
	"github.com/labstack/echo/v4"
	"github.com/nyaruka/phonenumbers"
	idmv1 "github.com/tierklinik-dobersberg/apis/gen/go/tkd/idm/v1"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	v1 "github.com/tierklinik-dobersberg/cis/pkg/models/customer/v1alpha"
	"github.com/tierklinik-dobersberg/logger"
	"go.mongodb.org/mongo-driver/bson"
	"google.golang.org/protobuf/types/known/fieldmaskpb"
)

// FuzzySearchEndpoint allows searching for customers using
// a double metaphone driven search on the customers name.
// trunk-ignore(golangci-lint/gocognit)
func FuzzySearchEndpoint(grp *app.Router) {
	grp.GET(
		"v1",
		func(ctx context.Context, app *app.App, c echo.Context) error {
			filter := bson.M{}
			singleResponse := c.QueryParam("single") != ""

			// get a list of all users if we should also include
			// users into the result.
			includeUsers := c.QueryParams().Has("includeUsers")
			if includeUsers && singleResponse {
				return httperr.BadRequest("cannot mix query parameters single and includeUsers")
			}

			var allProfiles []*idmv1.Profile

			if includeUsers {
				response, err := app.IDM.UserServiceClient.ListUsers(ctx, connect.NewRequest(&idmv1.ListUsersRequest{
					FieldMask: &fieldmaskpb.FieldMask{
						Paths: []string{"users.avatar"},
					},
					ExcludeFields: true,
				}))

				if err != nil {
					logger.From(ctx).Errorf("failed to load all users: %s", err)
					// we only log the error here because we still want to
					// search the customer database ...
				} else {
					allProfiles = response.Msg.Users
					logger.From(ctx).V(6).Logf("'includeUsers' enabled, loaded %d identities", len(allProfiles))
				}
			}

			textScore := false
			matchedProfiles := make(map[string]*idmv1.Profile)
			if name := c.QueryParam("name"); name != "" {
				textScore = true
				// m1, m2 := matchr.DoubleMetaphone(name)
				filter["$text"] = bson.M{
					"$search": name,
				}

				if includeUsers {
					for _, profile := range allProfiles {
						// TODO(ppacher): maybe search by doublemetaphone as well?
						if profile.User.Username == name || profile.User.DisplayName == name || profile.User.Id == name {
							matchedProfiles[profile.User.Id] = profile
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
					phoneToProfile := make(map[string]*idmv1.Profile)
					for _, profile := range allProfiles {
						for _, p := range profile.PhoneNumbers {
							number, err := phonenumbers.Parse(p.Number, app.Config.Country)
							if err != nil {
								logger.From(ctx).Errorf("failed to parse phone number from user %s: %s", profile.User.Id, err)

								continue
							}
							international := phonenumbers.Format(number, phonenumbers.INTERNATIONAL)
							phoneToProfile[international] = profile
							logger.From(ctx).V(7).Logf("adding %s with phone number %s", profile.User.Id, international)
						}
					}

					logger.From(ctx).V(7).Logf("built lookup map for user phone numbers (size=%d)", len(phoneToProfile))
					for _, p := range phoneNumbers {
						if profile, ok := phoneToProfile[p]; ok {
							matchedProfiles[profile.User.Id] = profile
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
					for _, profile := range allProfiles {
						for _, m := range profile.EmailAddresses {
							if m.Address == mail {
								matchedProfiles[profile.User.Id] = profile

								continue L
							}
						}
					}
				}
			}

			customers, err := app.Customers.FilterCustomer(ctx, filter, textScore)
			if err != nil {
				// only abort if we failed to get a single customer, otherwise
				// just log the error
				if len(customers) == 0 {
					return err
				} else {
					logger.From(ctx).Errorf("failed to filter customers: %s", err)
				}
			}

			if singleResponse {
				if len(customers) == 0 {
					return httperr.NotFound("customer", "filter")
				}

				return c.JSON(http.StatusOK, CustomerModel(ctx, customers[0]))
			}

			models := make([]*v1.Customer, 0, len(customers))
			if includeUsers {
				logger.From(ctx).Infof("includeUsers: found %d matching users", len(matchedProfiles))
				for _, profile := range matchedProfiles {
					phoneNumbers := make([]string, len(profile.PhoneNumbers))
					for idx, p := range profile.PhoneNumbers {
						phoneNumbers[idx] = p.Number
					}

					mails := make([]string, len(profile.EmailAddresses))
					for idx, m := range profile.EmailAddresses {
						mails[idx] = m.Address
					}

					displayName := profile.User.DisplayName
					if displayName == "" {
						displayName = profile.User.Username
					}

					models = append(models, &v1.Customer{
						ID:            profile.User.Id,
						Source:        "__identities",
						Group:         "Users",
						Name:          displayName,
						PhoneNumbers:  phoneNumbers,
						MailAddresses: mails,
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
