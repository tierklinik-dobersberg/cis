package identityapi

import (
	"context"
	"fmt"
	"net/url"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

// NewPermissionRequest returns a new permission request for c by either parsing
// the X-Original-URL header or by using a combination of X-Forwarded-Proto,
// X-Forwarded-Host and X-Forwarded-URI headers as a fallback. The User member
// of the permission request is set to the session user associated with c.
func NewPermissionRequest(ctx context.Context, c echo.Context) (*permission.Request, error) {
	user, _ := c.Get("session:user").(string)

	originalURL := c.Request().Header.Get("X-Original-URL")
	if originalURL != "" {
		perm, err := PermissionRequestFromURL(originalURL)
		if err != nil {
			return nil, err
		}

		perm.User = user

		return perm, nil
	}

	log.From(ctx).Infof("no X-Original-URL header present, using X-Forwarded headers")

	proto := c.Request().Header.Get("X-Forwarded-Proto")
	host := c.Request().Header.Get("X-Forwarded-Host")
	uri := c.Request().Header.Get("X-Forwarded-URI")

	return PermissionRequestFromURL(fmt.Sprintf("%s://%s/%s", proto, host, uri))
}

// PermissionRequestFromURL returns a new permission.Request by parsing the
// provided URL. Note that the User member of the returned permission.Request is
// not set.
func PermissionRequestFromURL(u string) (*permission.Request, error) {
	parsed, err := url.Parse(u)
	if err != nil {
		return nil, err
	}

	return &permission.Request{
		Resource: parsed.Path,
		//Domain:   parsed.Hostname(),
		//Scheme:   parsed.Scheme,
	}, nil
}
