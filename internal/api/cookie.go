package api

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/tierklinik-dobersberg/logger"
	"github.com/tierklinik-dobersberg/userhub/internal/crypt"
)

func (srv *Server) createSessionCookie(userName string, ttl time.Duration, secure bool) *http.Cookie {
	expires := time.Now().Add(ttl)
	expiresUnix := expires.Unix()
	signature := crypt.Signature(srv.cfg.Secret, srv.cfg.CookieDomain, userName, fmt.Sprintf("%d", expiresUnix))

	value := fmt.Sprintf("%s:%s:%d", signature, userName, expiresUnix)

	return &http.Cookie{
		Name:     srv.cfg.CookieName,
		Value:    value,
		Path:     "/",
		Domain:   srv.cfg.CookieDomain,
		HttpOnly: true,
		Secure:   secure,
		Expires:  expires,
	}
}

func (srv *Server) clearSessionCookie() *http.Cookie {
	return &http.Cookie{
		Name:     srv.cfg.CookieName,
		Value:    "",
		Path:     "/",
		Domain:   srv.cfg.CookieDomain,
		HttpOnly: true,
		Secure:   !srv.cfg.InsecureCookies,
		Expires:  time.Now().Add(-time.Hour),
	}
}

func (srv *Server) checkSessionCookie(r *http.Request) (userName string, expiresIn time.Duration) {
	log := logger.From(r.Context())

	var sessionCookie *http.Cookie

	for _, ck := range r.Cookies() {
		if ck.Name == srv.cfg.CookieName {
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

	validSig := crypt.VerifySignature(sig, srv.cfg.Secret, srv.cfg.CookieDomain, userName, expiresStr)
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
