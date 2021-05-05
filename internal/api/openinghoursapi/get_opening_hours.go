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
	"github.com/tierklinik-dobersberg/logger"
)

type GetOpeningHoursRangeResponse struct {
	Dates map[string] /*2006-01-02*/ GetOpeningHoursResponse `json:"dates"`
}

type GetOpeningHoursResponse struct {
	Frames    []utils.TimeRange `json:"openingHours"`
	IsHoliday bool              `json:"holiday"`
}

func GetOpeningHoursEndpoint(router *app.Router) {
	router.GET(
		"v1/opening-hours",
		permission.Anyone,
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			from := c.Query("from")
			to := c.Query("to")
			if from != "" || to != "" {
				if from == "" || to == "" {
					return httperr.BadRequest(nil, "from= and to= must both be set")
				}
				res, err := getOpeningHoursRangeResponse(ctx, app, from, to)
				if err != nil {
					return err
				}

				c.JSON(http.StatusOK, res)
				return nil
			}

			at := c.Query("at")
			res, err := getSingleDayOpeningHours(ctx, app, at, time.Now())
			if err != nil {
				return err
			}

			c.JSON(http.StatusOK, res)

			return nil
		},
	)
}

func getSingleDayOpeningHours(ctx context.Context, app *app.App, at string, d time.Time) (*GetOpeningHoursResponse, error) {
	if at != "" {
		var err error
		d, err = app.ParseTime("2006-1-2", at)
		if err != nil {
			return nil, httperr.InvalidParameter("at")
		}
	}

	frames := app.Door.OpeningFramesForDay(ctx, d)
	holiday, err := app.Holidays.IsHoliday(ctx, app.Config.Country, d)
	if err != nil {
		return nil, err
	}

	timeRanges := make([]utils.TimeRange, len(frames))
	for idx, frame := range frames {
		timeRanges[idx] = *frame.At(d, app.Location())
	}

	return &GetOpeningHoursResponse{
		Frames:    timeRanges,
		IsHoliday: holiday,
	}, nil
}

func getOpeningHoursRangeResponse(ctx context.Context, app *app.App, from, to string) (*GetOpeningHoursRangeResponse, error) {
	f, err := app.ParseTime("2006-1-2", from)
	if err != nil {
		return nil, httperr.InvalidParameter("from")
	}
	t, err := app.ParseTime("2006-1-2", to)
	if err != nil {
		return nil, httperr.InvalidParameter("to")
	}
	logger.From(ctx).Infof("loading opening hours in time range from %s to %s", from, to)

	if t.Before(f) || t.Equal(f) {
		return nil, httperr.BadRequest(nil, "invalid from/to values")
	}

	res := &GetOpeningHoursRangeResponse{
		Dates: make(map[string]GetOpeningHoursResponse),
	}

	current := f
	for current.Before(t) {
		day, err := getSingleDayOpeningHours(ctx, app, "", current)
		if err != nil {
			return nil, err
		}

		res.Dates[current.Format(time.RFC3339)] = *day

		current = current.AddDate(0, 0, 1)
	}

	return res, nil
}
