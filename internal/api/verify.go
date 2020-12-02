package api

import (
	"context"
	"encoding/base64"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/logger"
	"github.com/tierklinik-dobersberg/userhub/pkg/models/v1alpha"
)

func (srv *Server) verifyEndpoint(ctx *gin.Context) {
	var status int = http.StatusForbidden
	var user *v1alpha.User

	username, sessionExpiry := srv.checkSessionCookie(ctx.Request)
	if username != "" {
		status = http.StatusOK

		// try to get the user from the database, if that fails
		// the auth-request fails as well.
		u, err := srv.db.GetUser(ctx.Request.Context(), username)
		if err != nil {
			logger.From(ctx.Request.Context()).Infof("valid session for deleted user %s", user)
			sessionExpiry = 0
			status = http.StatusForbidden
		} else {
			user = &u
		}
	} else if header := ctx.Request.Header.Get("Authorization"); header != "" {
		// There's no session cookie available, check if the user
		// is trying basic-auth.
		status, user = srv.verifyBasicAuth(ctx.Request.Context(), header)
		sessionExpiry = 0
	}

	// on success, add user details as headers and
	// make sure there's a valid session cookie.
	if user != nil && status == http.StatusOK {
		ctx.Set("session:user", user.Name)

		req, err := NewPermissionRequest(ctx)
		if err != nil {
			log.Printf("%+v", ctx.Request.Header)
			logger.From(ctx.Request.Context()).Infof("failed to create permission request: %s", err)
			ctx.Status(http.StatusBadRequest)
			return
		}

		allowed, err := srv.matcher.Decide(ctx.Request.Context(), req)
		if err != nil {
			logger.From(ctx.Request.Context()).WithFields(req.AsFields()).Infof("failed to decide on permission request: %s", err)
			ctx.Status(http.StatusBadRequest)
			return
		}

		if !allowed {
			logger.From(ctx.Request.Context()).WithFields(req.AsFields()).Info("access denied")
			ctx.Status(http.StatusForbidden)
			return
		}

		addRemoteUserHeaders(*user, ctx.Writer)

		// make sure we have a valid session and if it's going to
		// expire soon renew it now.
		if sessionExpiry < time.Minute*5 {
			cookie := srv.createSessionCookie(
				user.Name,
				time.Hour,
				!srv.cfg.InsecureCookies,
			)
			http.SetCookie(ctx.Writer, cookie)
		}

		ctx.Status(status)

		return
	}

	http.SetCookie(
		ctx.Writer,
		srv.clearSessionCookie(),
	)
	ctx.Status(status)
}

func (srv *Server) verifyBasicAuth(ctx context.Context, header string) (int, *v1alpha.User) {
	// We only support "Basic" auth so error out immediately for any
	// other technique.
	if !strings.HasPrefix(header, "Basic ") {
		return http.StatusBadRequest, nil
	}

	// get the base64 encoded user:password string
	blob, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(header, "Basic "))
	if err != nil {
		return http.StatusBadRequest, nil
	}

	// split user and passwort apart
	parts := strings.SplitN(string(blob), ":", 2)
	if len(parts) != 2 {
		return http.StatusBadRequest, nil
	}

	// and finally try to authenticate the user.
	if srv.db.Authenticate(ctx, parts[0], parts[1]) {
		user, err := srv.db.GetUser(ctx, parts[0])
		if err != nil {
			return http.StatusBadRequest, nil
		}

		return http.StatusOK, &user
	}
	return http.StatusForbidden, nil
}

func addRemoteUserHeaders(u v1alpha.User, w http.ResponseWriter) {
	w.Header().Set("Remote-User", u.Name)
	w.Header().Set("Remote-FullName", u.Fullname)

	for _, mail := range u.Mail {
		w.Header().Add("Remote-Mail", mail)
	}

	for _, phone := range u.PhoneNumber {
		w.Header().Add("Remote-Phone", phone)
	}

	for _, group := range u.GroupNames {
		w.Header().Add("Remote-Group", group)
	}
}
