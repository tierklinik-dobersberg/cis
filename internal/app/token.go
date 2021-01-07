package app

import (
	"time"

	"github.com/tierklinik-dobersberg/cis/internal/jwt"
	"github.com/tierklinik-dobersberg/cis/pkg/models/identity/v1alpha"
)

// CreateUserToken creates a new signed JWT token issed for
// user.
func (app *App) CreateUserToken(user v1alpha.User) (string, error) {
	var mail string
	if len(user.Mail) > 0 {
		mail = user.Mail[0]
	}

	claims := jwt.Claims{
		Audience:  app.Config.Audience,
		Issuer:    app.Config.Issuer,
		IssuedAt:  time.Now().Unix(),
		ExpiresAt: time.Now().Add(time.Hour).Unix(),
		NotBefore: time.Now().Unix(),
		AppMetadata: &jwt.AppMetadata{
			Authorization: &jwt.Authorization{
				Roles: user.Roles,
			},
		},
		Email:   mail,
		Subject: user.Name,
		Name:    user.Fullname,
		// TODO(ppacher): ID for revoking?
	}

	token, err := jwt.SignToken(app.Config.SigningMethod, []byte(app.Config.Secret), claims)
	if err != nil {
		return "", err
	}

	return token, nil
}

// VerifyUserToken verifies a user token and returns the claims
// encoded into the JWT.
func (app *App) VerifyUserToken(token string) (*jwt.Claims, error) {
	return jwt.ParseAndVerify([]byte(app.Config.Secret), token)
}
