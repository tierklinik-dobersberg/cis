package session

import (
	"net/http"
	"path"
	"time"

	"github.com/gin-gonic/gin"
)

// CookieFactory creates and deletes HTTP cookies.
type CookieFactory struct {
	Domain          string
	BasePath        string
	InsecureCookies bool
}

// Clear removes the cookie with the given name.
func (factory *CookieFactory) Clear(cookieName, relPath string, c *gin.Context) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:   cookieName,
		Path:   path.Join(factory.BasePath, relPath),
		Domain: factory.Domain,
		MaxAge: -1,
	})
}

// Create wraps value in a http cookie with name.
func (factory *CookieFactory) Create(name, value, relPath string, ttl time.Duration) *http.Cookie {
	return &http.Cookie{
		Name:     name,
		Value:    value,
		Path:     path.Join(factory.BasePath, relPath),
		Domain:   factory.Domain,
		HttpOnly: true,
		Secure:   !factory.InsecureCookies,
		Expires:  time.Now().Add(ttl),
	}
}
