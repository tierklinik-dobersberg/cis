package api

import (
	"fmt"
	"net/url"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/logger"
)

// PermissionRequest describes a permission request received on /api/verify.
type PermissionRequest struct {
	// User is the user that tries to perfom the operation.
	User string
	// Domain is the target domain/host of the operation.
	Domain string
	// Resource is the path of the resourc eon the target host.
	Resource string
	// Scheme is the used scheme for the operation and is likely either
	// "http" or "https"
	Scheme string
}

// NewPermissionRequest returns a new permission request for c by either parsing
// the X-Original-URL header or by using a combination of X-Forwarded-Proto,
// X-Forwarded-Host and X-Forwarded-URI headers as a fallback. The User member
// of the permission request is set to the session user associated with c.
func NewPermissionRequest(c *gin.Context) (*PermissionRequest, error) {
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

// PermissionRequestFromURL returns a new PermissionRequest by parsing the
// provided URL. Note that the User member of the returned PermissionRequest is
// not set.
func PermissionRequestFromURL(u string) (*PermissionRequest, error) {
	parsed, err := url.Parse(u)
	if err != nil {
		return nil, err
	}

	return &PermissionRequest{
		Resource: parsed.Path,
		Domain:   parsed.Hostname(),
		Scheme:   parsed.Scheme,
	}, nil
}
