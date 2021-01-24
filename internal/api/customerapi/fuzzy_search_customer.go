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
	v1 "github.com/tierklinik-dobersberg/cis/pkg/models/customer/v1alpha"
	"go.mongodb.org/mongo-driver/bson"
)

// FuzzySearchEndpoint allows searching for customers using
// a double metaphone driven search on the customers name.
func FuzzySearchEndpoint(grp *app.Router) {
	grp.GET(
		"v1/",
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			filter := bson.M{}

			if name := c.Query("name"); name != "" {
				m1, m2 := matchr.DoubleMetaphone(name)
				filter["$text"] = bson.M{
					"$search":   m1 + " " + m2,
					"$language": "de",
				}
			}

			if phone := c.Query("phone"); phone != "" {
				number, err := phonenumbers.Parse(phone, app.Config.Country)
				if err != nil {
					return httperr.BadRequest(err, "Invalid phone number")
				}

				filter["phoneNumbers"] = bson.M{
					"$in": []string{
						phonenumbers.Format(number, phonenumbers.NATIONAL),
						phonenumbers.Format(number, phonenumbers.INTERNATIONAL),
					},
				}
			}

			if city := c.Query("city"); city != "" {
				filter["city"] = city
			}

			if cityCode := c.Query("cityCode"); cityCode != "" {
				parsed, err := strconv.ParseInt(cityCode, 10, 0)
				if err != nil {
					return httperr.BadRequest(err, "Invalid city code")
				}

				filter["cityCode"] = parsed
			}

			if mail := c.Query("mail"); mail != "" {
				filter["mailAddresses"] = mail
			}

			customers, err := app.Customers.FilterCustomer(ctx, filter)
			if err != nil {
				return err
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
