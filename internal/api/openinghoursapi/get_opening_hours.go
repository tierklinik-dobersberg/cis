package openinghoursapi

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/bufbuild/connect-go"
	"github.com/labstack/echo/v4"
	calendarv1 "github.com/tierklinik-dobersberg/apis/gen/go/tkd/calendar/v1"
	commonv1 "github.com/tierklinik-dobersberg/apis/gen/go/tkd/common/v1"
	"github.com/tierklinik-dobersberg/apis/pkg/discovery/consuldiscover"
	"github.com/tierklinik-dobersberg/apis/pkg/discovery/wellknown"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/pkg/daytime"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/logger"
)

type GetOpeningHoursRangeResponse struct {
	Dates map[string] /*2006-01-02*/ GetOpeningHoursResponse `json:"dates"`
}

type TimeRange struct {
	daytime.TimeRange
}

type GetOpeningHoursResponse struct {
	Frames    []TimeRange `json:"openingHours"`
	IsHoliday bool        `json:"holiday"`
}

func GetOpeningHoursEndpoint(router *app.Router) {
	router.GET(
		"v1/opening-hours",
		func(ctx context.Context, app *app.App, c echo.Context) error {
			from := c.QueryParam("from")
			to := c.QueryParam("to")
			if from != "" || to != "" {
				if from == "" || to == "" {
					return httperr.BadRequest("from= and to= must both be set")
				}
				res, err := getOpeningHoursRangeResponse(ctx, app, from, to)
				if err != nil {
					return err
				}

				return c.JSON(http.StatusOK, res)
			}

			at := c.QueryParam("at")
			res, err := getSingleDayOpeningHours(ctx, app, at, time.Now())
			if err != nil {
				return err
			}

			return c.JSON(http.StatusOK, res)
		},
	)
}

func getSingleDayOpeningHours(ctx context.Context, app *app.App, at string, date time.Time) (*GetOpeningHoursResponse, error) {
	if at != "" {
		var err error
		date, err = app.ParseTime("2006-1-2", at)
		if err != nil {
			return nil, httperr.InvalidParameter("at", err.Error())
		}
	}

	frames := app.Door.ForDate(ctx, date)
	holiday, err := isHoliday(ctx, date)
	if err != nil {
		return nil, err
	}

	timeRanges := make([]TimeRange, len(frames))
	for idx, frame := range frames {
		timeRanges[idx] = TimeRange{
			TimeRange: *frame.At(date, app.Location()),
		}
	}

	return &GetOpeningHoursResponse{
		Frames:    timeRanges,
		IsHoliday: holiday,
	}, nil
}

func isHoliday(ctx context.Context, date time.Time) (bool, error) {
	disc, err := consuldiscover.NewFromEnv()
	if err != nil {
		return false, fmt.Errorf("failed to get consul service catalog: %w", err)
	}

	cli, err := wellknown.HolidayService.Create(ctx, disc)
	if err != nil {
		return false, fmt.Errorf("failed to get holiday service client: %w", err)
	}

	res, err := cli.IsHoliday(ctx, connect.NewRequest(&calendarv1.IsHolidayRequest{
		Date: &commonv1.Date{
			Year:  int64(date.Year()),
			Month: commonv1.Month(date.Month()),
			Day:   int32(date.Day()),
		},
	}))
	if err != nil {
		return false, fmt.Errorf("failed to query holiday service: %w", err)
	}

	return res.Msg.IsHoliday, nil
}

func getOpeningHoursRangeResponse(ctx context.Context, app *app.App, from, to string) (*GetOpeningHoursRangeResponse, error) {
	fromTime, err := app.ParseTime("2006-1-2", from)
	if err != nil {
		return nil, httperr.InvalidParameter("from", err.Error())
	}
	toTime, err := app.ParseTime("2006-1-2", to)
	if err != nil {
		return nil, httperr.InvalidParameter("to", err.Error())
	}
	logger.From(ctx).Infof("loading opening hours in time range from %s to %s", from, to)

	if toTime.Before(fromTime) || toTime.Equal(fromTime) {
		return nil, httperr.BadRequest("invalid from/to values")
	}

	res := &GetOpeningHoursRangeResponse{
		Dates: make(map[string]GetOpeningHoursResponse),
	}

	current := fromTime
	for current.Before(toTime) {
		day, err := getSingleDayOpeningHours(ctx, app, "", current)
		if err != nil {
			return nil, err
		}

		res.Dates[current.Format(time.RFC3339)] = *day

		current = current.AddDate(0, 0, 1)
	}

	return res, nil
}
