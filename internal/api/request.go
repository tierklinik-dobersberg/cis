package api

import (
	"fmt"
	"net/url"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/logger"
	"github.com/tierklinik-dobersberg/userhub/internal/permission"
)

// NewPermissionRequest returns a new permission request for c by either parsing
// the X-Original-URL header or by using a combination of X-Forwarded-Proto,
// X-Forwarded-Host and X-Forwarded-URI headers as a fallback. The User member
// of the permission request is set to the session user associated with c.
func NewPermissionRequest(c *gin.Context) (*permission.Request, error) {
	user := c.GetString("session:user")

	originalURL := c.Request.Header.Get("X-Original-URL")
	if originalURL != "" {
		perm, err := PermissionRequestFromURL(originalURL)
		if err != nil {
			return nil, err
		}

		perm.User = user
		return perm, nil
	}

	logger.From(c.Request.Context()).Infof("no X-Original-URL header present, using X-Forwarded headers")

	proto := c.Request.Header.Get("X-Forwarded-Proto")
	host := c.Request.Header.Get("X-Forwarded-Host")
	uri := c.Request.Header.Get("X-Forwarded-URI")

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
		Domain:   parsed.Hostname(),
		Scheme:   parsed.Scheme,
	}, nil
}
