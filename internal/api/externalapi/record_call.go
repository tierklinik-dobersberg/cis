package externalapi

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/api/calllogapi"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/pkg/models/calllog/v1alpha"
)

type recordCallRequest struct {
	Duration       string `json:"duration"`
	Number         string `json:"number"`
	Agent          string `json:"agent"`
	CallType       string `json:"callType"`
	DateTime       string `json:"dateTime"`
	CustomerID     string `json:"cid"`
	CustomerSource string `json:"source"`
}

// RecordCallEndpoint allows to record an incoming phone call in the calllog.
// trunk-ignore(golangci-lint/cyclop)
func RecordCallEndpoint(grp *app.Router) {
	grp.POST(
		"v1/calllog",
		permission.OneOf{
			calllogapi.CreateRecordAction,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			caller := c.QueryParam("ani")

			// If we have a caller than this is an "unidentified" call record
			// send by the callflow app.
			// trunk-ignore(golangci-lint/nestif)
			if caller != "" {
				record := v1alpha.CallLog{
					Date:          time.Now(),
					Caller:        caller,
					InboundNumber: c.QueryParam("did"),
				}

				if transferTo := c.QueryParam("transferTo"); transferTo != "" {
					record.TransferTarget = transferTo
				}

				if errparam := c.QueryParam("error"); errparam != "" {
					b, err := strconv.ParseBool(errparam)
					if err != nil {
						log.From(ctx).Errorf("invalid error boolean %q, assuming true", err)
						b = true
					}
					record.Error = b
				}

				if err := app.CallLogs.CreateUnidentified(ctx, record); err != nil {
					return httperr.InternalError().SetInternal(err)
				}

				return c.NoContent(http.StatusNoContent)
			}

			// otherwise, we should have a body containing a calllog record
			// for an identified customer
			var payload recordCallRequest
			if err := json.NewDecoder(c.Request().Body).Decode(&payload); err != nil {
				return httperr.BadRequest().SetInternal(err)
			}

			record := v1alpha.CallLog{
				Caller:         payload.Number,
				Agent:          payload.Agent,
				CustomerID:     payload.CustomerID,
				CustomerSource: payload.CustomerSource,
				CallType:       payload.CallType,
			}

			if payload.Duration != "" {
				durationSeconds, err := strconv.ParseUint(payload.Duration, 10, 64)
				if err != nil {
					return httperr.InvalidField("duration")
				}
				record.DurationSeconds = durationSeconds
			}

			date, err := app.ParseTime("02.01.2006 15:04", payload.DateTime)
			if err != nil {
				log.From(ctx).Errorf("failed to parse calllog dateTime %s: %s", payload.DateTime, err)

				return httperr.InvalidField("dateTime")
			}
			record.Date = date

			if err := app.CallLogs.RecordCustomerCall(ctx, record); err != nil {
				return err
			}

			return c.NoContent(http.StatusNoContent)
		},
	)
}
