package customerapi

import (
	"context"
	"net/http"
	"strconv"

	"github.com/antzucaro/matchr"
	"github.com/gin-gonic/gin"
	"github.com/nyaruka/phonenumbers"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/httperr"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	v1 "github.com/tierklinik-dobersberg/cis/pkg/models/customer/v1alpha"
	"github.com/tierklinik-dobersberg/logger"
	"go.mongodb.org/mongo-driver/bson"
)

// FuzzySearchEndpoint allows searching for customers using
// a double metaphone driven search on the customers name.
func FuzzySearchEndpoint(grp *app.Router) {
	grp.GET(
		"v1/",
		permission.Set{
			ReadCustomerAction,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			filter := bson.M{}
			singleResponse := c.Query("single") != ""

			if name := c.Query("name"); name != "" {
				m1, m2 := matchr.DoubleMetaphone(name)
				filter["$text"] = bson.M{
					"$search":   m1 + " " + m2,
					"$language": "de",
				}
			}

			if phoneQueries, ok := c.GetQueryArray("phone"); ok && len(phoneQueries) > 0 {
				phoneNumbers := []string{}
				for _, phone := range phoneQueries {
					if phone == "" {
						continue
					}
					number, err := phonenumbers.Parse(phone, app.Config.Country)
					if err != nil {
						return httperr.InvalidParameter("phone")
					}
					phoneNumbers = append(phoneNumbers, phonenumbers.Format(number, phonenumbers.NATIONAL))
					phoneNumbers = append(phoneNumbers, phonenumbers.Format(number, phonenumbers.INTERNATIONAL))
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
			}

			logger.Infof(ctx, "%+v", filter)

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

			models := make([]*v1.Customer, len(customers))
			for idx, cu := range customers {
				m := CustomerModel(ctx, cu)
				models[idx] = m
			}

			c.JSON(http.StatusOK, models)
			return nil
		},
	)
}
