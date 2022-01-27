package commentapi

import (
	"encoding/json"
	"io/ioutil"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
)

func readCommentMessage(c echo.Context) (string, error) {
	var msg string
	contentType := c.Request().Header.Get("Content-Type")
	switch {
	case strings.Contains(contentType, "application/json"):
		if err := json.NewDecoder(c.Request().Body).Decode(&msg); err != nil {
			return "", httperr.BadRequest(err)
		}

	case strings.Contains(contentType, "text/plain"):
		blob, err := ioutil.ReadAll(c.Request().Body)
		if err != nil {
			return "", httperr.InternalError("incomplete read").SetInternal(err)
		}

		msg = string(blob)

	default:
		return "", httperr.BadRequest("unsupported content type: " + contentType)
	}
	return msg, nil
}
