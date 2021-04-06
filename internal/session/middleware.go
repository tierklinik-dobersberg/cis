package session

import (
	"errors"
	"io/ioutil"
	"net/http"
	"net/http/httputil"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/database/identitydb"
	"github.com/tierklinik-dobersberg/cis/internal/httperr"
	"github.com/tierklinik-dobersberg/cis/internal/jwt"
	"github.com/tierklinik-dobersberg/cis/internal/pkglog"
	"github.com/tierklinik-dobersberg/cis/pkg/models/identity/v1alpha"
)

var log = pkglog.New("session")

// Middleware extracts session data from incoming HTTP requests
// and handles automatic issueing of new access tokens for
// provided refresh tokens.
func (mng *Manager) Middleware(c *gin.Context) {
	log := log.From(c.Request.Context())

	aborted := false
	defer func() {
		if aborted {
			return
		}
		c.Next()
	}()

	// if someone else already added a session we'll skip
	// everything here.
	session := Get(c)
	if session != nil {
		log.Infof("request is already assigned to %s", session)
		return
	}

	// get access and refresh tokens
	//
	accessToken, accessUser, err := mng.getAccessToken(c)
	if err != nil {
		log.V(3).Logf("failed to get access token: %s", err)
		return
	}
	refreshToken, refreshUser, err := mng.getRefreshToken(c)
	if err != nil {
		log.V(3).Logf("failed to get refresh token: %s", err)
		return
	}

	// if there's neither a refresh nor an access token we'll
	// skip it.
	if refreshToken == nil && accessToken == nil {
		log.V(3).Log("unauthenticated request: no access or refresh token provided")

		reqBlob, err := httputil.DumpRequest(c.Request, true)
		if err != nil {
			log.Errorf("failed to dump request: %s", err)
			return
		}
		if err := ioutil.WriteFile("/log/request.dump", reqBlob, 0700); err != nil {
			log.Errorf("failed to dump request: %s", err)
		}

		return
	}

	// If we have access and refresh tokens they MUST belong to the same user!
	if accessUser != nil && refreshUser != nil && accessUser.Name != refreshUser.Name {
		aborted = true
		// TODO(ppacher): INCIDENT!
		log.V(3).Logf("security alert: access and refresh token user differ: %s != %s", accessUser.Name, refreshUser.Name)
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	user := accessUser
	if user == nil {
		user = refreshUser
	}
	if user == nil {
		aborted = true
		c.AbortWithStatus(http.StatusInternalServerError)
		log.V(3).Log("request denied: failed to find user for token")
		return
	}

	// at this point we have a valid session
	// (either access scope, refresh scope or both)
	session = &Session{
		User:  *user,
		Roles: user.Roles,
	}

	// expires-at must still be in the future, otherwise
	// the tokens would not have been valid and we wouldn't
	// get here anyway.
	if accessToken != nil {
		t := time.Unix(accessToken.ExpiresAt, 0)
		session.AccessUntil = &t
	}
	if refreshToken != nil {
		t := time.Unix(refreshToken.ExpiresAt, 0)
		session.RefreshUntil = &t
	}

	// if we don't have a valid access or refresh scope now
	// return without setting a session on c.
	if session.AccessUntil == nil && session.RefreshUntil == nil {
		log.V(3).Logf("unauthenticated request: no valid access or refresh token found: %s", session)
		return
	}

	log.V(6).Logf("session %s valid", session)

	// add the session to the gin context.
	Set(c, session)
}

// IssueAccessToken creates a new access token for the active session.
// The session must have a valid refresh token set.
func (mng *Manager) IssueAccessToken(c *gin.Context) (string, error) {
	sess := Get(c)
	if sess == nil {
		return "", httperr.New(http.StatusUnauthorized, errors.New("no session found"), nil)
	}

	if sess.RefreshUntil == nil || sess.RefreshUntil.Before(time.Now()) {
		return "", httperr.New(http.StatusUnauthorized, errors.New("no or expired refresh token"), nil)
	}

	token, _, err := mng.GenerateAccessToken(sess.User)
	if err != nil {
		return "", httperr.Wrap(err)
	}

	http.SetCookie(
		c.Writer,
		mng.cookieFactory.Create(
			mng.identityConfg.AccessTokenCookie,
			token,
			"",
			mng.identityConfg.AccessTokenTTL,
		),
	)

	return token, nil
}

// Require aborts an incoming http request if it does not have
// a valid session token.
func Require() gin.HandlerFunc {
	return func(c *gin.Context) {
		sess := Get(c)
		if sess == nil || sess.AccessUntil == nil {
			if sess == nil {
				log.From(c.Request.Context()).Infof("Request without a valid session, aborting")
			} else {
				log.From(c.Request.Context()).Infof("Request session without access scope, aborting")
			}
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "no access token provided",
			})
			return
		}

		c.Next()
	}
}

func cookieValueOrBearer(cookieName string, r *http.Request) string {
	cookie, err := r.Cookie(cookieName)
	if err == nil {
		return cookie.Value
	}

	if h := r.Header.Get("Authorization"); strings.HasPrefix(h, "Bearer ") {
		return strings.TrimPrefix(h, "Bearer ")
	}

	return ""
}

func (mng *Manager) getAccessToken(c *gin.Context) (*jwt.Claims, *v1alpha.User, error) {
	tokenValue := cookieValueOrBearer(mng.identityConfg.AccessTokenCookie, c.Request)
	if tokenValue == "" {
		return nil, nil, nil
	}

	claims, err := mng.VerifyUserToken(tokenValue)
	if err != nil {
		return nil, nil, err
	}

	if hasScope(claims.Scopes, jwt.ScopeAccess) {
		ctx := identitydb.WithScope(c.Request.Context(), identitydb.Internal)
		user, err := mng.identities.GetUser(ctx, claims.Subject)
		if err != nil {
			return nil, nil, err
		}

		return claims, &user.User, nil
	}

	// there's a token but it does not have the "access" scope.
	return nil, nil, nil
}

func (mng *Manager) getRefreshToken(c *gin.Context) (*jwt.Claims, *v1alpha.User, error) {
	tokenValue := cookieValueOrBearer(mng.identityConfg.RefreshTokenCookie, c.Request)
	if tokenValue == "" {
		return nil, nil, nil
	}

	claims, err := mng.VerifyUserToken(tokenValue)
	if err != nil {
		return nil, nil, err
	}

	if hasScope(claims.Scopes, jwt.ScopeRefresh) {
		ctx := identitydb.WithScope(c.Request.Context(), identitydb.Internal)
		user, err := mng.identities.GetUser(ctx, claims.Subject)
		if err != nil {
			return nil, nil, err
		}

		return claims, &user.User, nil
	}

	// There's a token but it does not have the "refresh" scope.
	return nil, nil, nil
}

func hasScope(haystack []jwt.Scope, needle jwt.Scope) bool {
	for _, s := range haystack {
		if s == needle {
			return true
		}
	}
	return false
}
