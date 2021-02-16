package externalapi

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/api/calllogapi"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/httperr"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/models/calllog/v1alpha"
	"github.com/tierklinik-dobersberg/logger"
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
func RecordCallEndpoint(grp *app.Router) {
	grp.POST(
		"v1/calllog",
		permission.OneOf{
			calllogapi.CreateRecordAction,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			caller := c.Query("ani")

			// If we have a caller than this is an "unidentified" call record
			// send by the callflow app.
			if caller != "" {
				record := v1alpha.CallLog{
					Date:          time.Now(),
					Caller:        caller,
					InboundNumber: c.Query("did"),
				}

				if transferTo := c.Query("transferTo"); transferTo != "" {
					record.TransferTarget = transferTo
				}

				if errparam := c.Query("error"); errparam != "" {
					b, err := strconv.ParseBool(errparam)
					if err != nil {
						logger.From(ctx).Errorf("invalid error boolean %q, assuming true", err)
						b = true
					}
					record.Error = b
				}

				if err := app.CallLogs.CreateUnidentified(ctx, record); err != nil {
					return httperr.InternalError(err)
				}
			} else {
				// otherwise, we should have a body containg a calllog record
				// for an identified customer
				var payload recordCallRequest
				if err := json.NewDecoder(c.Request.Body).Decode(&payload); err != nil {
					return httperr.BadRequest(err)
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

				date, err := time.ParseInLocation("02.01.2006 15:04", payload.DateTime, app.Location())
				if err != nil {
					logger.Errorf(ctx, "failed to parse calllog dateTime %s: %s", payload.DateTime, err)
					return httperr.InvalidField("dateTime")
				}
				record.Date = date

				if err := app.CallLogs.RecordCustomerCall(ctx, record); err != nil {
					return err
				}
			}

			/*
				reqBlob, err := httputil.DumpRequest(c.Request, true)
				if err != nil {
					logger.Errorf(ctx, "failed to dump request: %s", err)
				}
				if err := ioutil.WriteFile("/log/record-call-request.dump", reqBlob, 0700); err != nil {
					logger.Errorf(ctx, "failed to dump request: %s", err)
				}
			*/

			c.Status(http.StatusNoContent)
			return nil
		},
	)
}
