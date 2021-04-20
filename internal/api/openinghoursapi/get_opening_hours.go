package openinghoursapi

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/httperr"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/internal/utils"
)

type GetOpeningHoursResponse struct {
	Frames    []utils.TimeRange `json:"openingHours"`
	IsHoliday bool              `json:"holiday"`
}

func GetOpeningHoursEndpoint(router *app.Router) {
	router.GET(
		"v1/opening-hours",
		permission.Anyone,
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			d := time.Now()
			if at := c.Query("at"); at != "" {
				var err error
				d, err = app.ParseTime("2006-1-2", at)
				if err != nil {
					return httperr.InvalidParameter("at")
				}
			}

			frames := app.Door.OpeningFramesForDay(ctx, d)
			holiday, err := app.Holidays.IsHoliday(ctx, app.Config.Country, d)
			if err != nil {
				return err
			}

			timeRanges := make([]utils.TimeRange, len(frames))
			for idx, frame := range frames {
				timeRanges[idx] = *frame.At(d, app.Location())
			}

			c.JSON(http.StatusOK, GetOpeningHoursResponse{
				Frames:    timeRanges,
				IsHoliday: holiday,
			})

			return nil
		},
	)
}
