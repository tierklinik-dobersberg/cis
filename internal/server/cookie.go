package server

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/logger"
	"github.com/tierklinik-dobersberg/userhub/internal/crypt"
)

func (srv *Server) logUser() gin.HandlerFunc {
	return func(c *gin.Context) {
		user, expiresIn := srv.CheckSession(c.Request)

		if user != "" && expiresIn > 0 {
			c.Set("session:user", user)
			c.Set("session:ttl", expiresIn.String())
		}

		c.Next()
	}
}

func (srv *Server) SessionUser(c *gin.Context) string {
	val, ok := c.Get("session:user")
	if !ok {
		return ""
	}

	u, ok := val.(string)
	if !ok {
		return ""
	}
	return u
}

func (srv *Server) CreateSessionCookie(userName string, ttl time.Duration, secure bool) *http.Cookie {
	expires := time.Now().Add(ttl)
	expiresUnix := expires.Unix()
	signature := crypt.Signature(srv.Config.Secret, srv.Config.CookieDomain, userName, fmt.Sprintf("%d", expiresUnix))

	value := fmt.Sprintf("%s:%s:%d", signature, userName, expiresUnix)

	return &http.Cookie{
		Name:     srv.Config.CookieName,
		Value:    value,
		Path:     "/",
		Domain:   srv.Config.CookieDomain,
		HttpOnly: true,
		Secure:   secure,
		Expires:  expires,
	}
}

func (srv *Server) ClearSessionCookie() *http.Cookie {
	return &http.Cookie{
		Name:     srv.Config.CookieName,
		Value:    "",
		Path:     "/",
		Domain:   srv.Config.CookieDomain,
		HttpOnly: true,
		Secure:   !srv.Config.InsecureCookies,
		Expires:  time.Now().Add(-time.Hour),
	}
}

func (srv *Server) CheckSession(r *http.Request) (userName string, expiresIn time.Duration) {
	log := logger.From(r.Context())

	var sessionCookie *http.Cookie

	for _, ck := range r.Cookies() {
		if ck.Name == srv.Config.CookieName {
			sessionCookie = ck
			break
		}
	}

	if sessionCookie == nil {
		log.Info("no session cookie available")
		return "", 0
	}

	parts := strings.Split(sessionCookie.Value, ":")
	if len(parts) != 3 {
		log.Infof("invalid session cookie: unexpected number of parts: %q", sessionCookie.Value)
		return "", 0
	}

	sig := parts[0]
	userName = parts[1]
	expiresStr := parts[2]

	validSig := crypt.VerifySignature(sig, srv.Config.Secret, srv.Config.CookieDomain, userName, expiresStr)
	if !validSig {
		// TODO(ppacher): block the requestor IP as it's obviously tempering
		// with our session cookies?
		log.Info("session cookie has invalid signature for domain")
		return "", 0
	}

	expiresUnix, err := strconv.ParseInt(expiresStr, 10, 64)
	if err != nil {
		log.Infof("session has invalid expiration: %s", err)
		return "", 0
	}

	expires := time.Unix(expiresUnix, 0)

	if expires.Before(time.Now()) {
		log.Info("session cookie is expired")
		return "", 0
	}

	log.Infof("valid session cookie for user %s, expires in %s", userName, expires.Sub(time.Now()))

	return userName, expires.Sub(time.Now())
}
