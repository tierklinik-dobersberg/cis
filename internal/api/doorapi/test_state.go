package doorapi

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
)

// TestStateEndpoint allows to test the desired door state for any
// point in time.
func TestStateEndpoint(grp *app.Router) {
	grp.GET(
		"v1/test/:year/:month/:day/:hour/:minute",
		permission.OneOf{
			GetStateAction,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			year, err := getIntParam("year", c)
			if err != nil {
				return err
			}
			month, err := getIntParam("month", c)
			if err != nil {
				return err
			}
			day, err := getIntParam("day", c)
			if err != nil {
				return err
			}
			hour, err := getIntParam("hour", c)
			if err != nil {
				return err
			}
			minute, err := getIntParam("minute", c)
			if err != nil {
				return err
			}

			date := time.Date(year, time.Month(month), day, hour, minute, 0, 0, app.Location())

			result, until := app.Door.StateFor(ctx, date)
			c.JSON(http.StatusOK, gin.H{
				"desiredState": string(result),
				"until":        until.Format(time.RFC3339),
			})
			return nil
		},
	)
}

func getIntParam(name string, c *gin.Context) (int, error) {
	stringValue := c.Param(name)

	// strip away the first leading zero if any
	if stringValue[0] == '0' {
		stringValue = stringValue[1:]
	}

	value, err := strconv.ParseInt(stringValue, 0, 0)
	if err != nil {
		return 0, httperr.InvalidParameter(name, err.Error())
	}

	return int(value), nil
}
