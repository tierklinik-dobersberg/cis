// Inspired by and designed to work with
// https://github.com/greenpau/caddy-auth-jwt/

// Package jwt provides JWT token signing.
package jwt

import (
	"errors"
	"fmt"
	"time"

	jwtlib "github.com/dgrijalva/jwt-go"
)

var supportedMethods = map[string]struct{}{
	"HS512": {},
	"HS384": {},
	"HS256": {},
}

// Authorization contains app related authorization and permission
// settings.
type Authorization struct {
	Roles []string `json:"roles,omitempty" xml:"roles" yaml:"roles,omitempty"`
}

// AppMetadata defines app specific metadata attached to
// JWT tokens issued by cisd.
type AppMetadata struct {
	Authorization *Authorization `json:"authorization,omitempty" xml:"authorization" yaml:"authorization,omitempty"`
}

// Claims represents the claims added to a JWT token issued
// by cisd.
type Claims struct {
	Audience    string       `json:"aud,omitempty" xml:"aud" yaml:"aud,omitempty"`
	ExpiresAt   int64        `json:"exp,omitempty" xml:"exp" yaml:"exp,omitempty"`
	ID          string       `json:"jti,omitempty" xml:"jti" yaml:"jti,omitempty"`
	IssuedAt    int64        `json:"iat,omitempty" xml:"iat" yaml:"iat,omitempty"`
	Issuer      string       `json:"iss,omitempty" xml:"iss" yaml:"iss,omitempty"`
	NotBefore   int64        `json:"nbf,omitempty" xml:"nbf" yaml:"nbf,omitempty"`
	Subject     string       `json:"sub,omitempty" xml:"sub" yaml:"sub,omitempty"`
	Name        string       `json:"name,omitempty" xml:"name" yaml:"name,omitempty"`
	Email       string       `json:"email,omitempty" xml:"email" yaml:"email,omitempty"`
	AppMetadata *AppMetadata `json:"app_metadata,omitempty" xml:"app_metadata" yaml:"app_metadata,omitempty"`
}

// Valid returns true if the token is valid and can be used.
// It checks if the token has been expired or may not yet be
// used.
func (u Claims) Valid() error {
	if u.NotBefore > 0 && time.Now().Unix() < u.NotBefore {
		return errors.New("token not yet valid")
	}

	if u.ExpiresAt > 0 && u.ExpiresAt < time.Now().Unix() {
		return errors.New("token expired")
	}

	return nil
}

// Sign returns a signed JWT token from u.
func (u *Claims) Sign(method string, secret []byte) (string, error) {
	return SignToken(method, secret, *u)
}

// SignToken returns a signed JWT token.
func SignToken(method string, secret []byte, claims Claims) (string, error) {
	if _, exists := supportedMethods[method]; !exists {
		return "", fmt.Errorf("unsupported signing method %q", method)
	}

	if secret == nil {
		return "", fmt.Errorf("missing secret")
	}

	sm := jwtlib.GetSigningMethod(method)
	token := jwtlib.NewWithClaims(sm, claims)
	signedToken, err := token.SignedString(secret)

	if err != nil {
		return "", err
	}
	return signedToken, nil
}

// ParseAndVerify parses the JWT token and verifies it's signature.
func ParseAndVerify(method string, secret []byte, token string) (*Claims, error) {
	var c Claims

	_, err := jwtlib.ParseWithClaims(token, &c, func(t *jwtlib.Token) (interface{}, error) {
		if t.Method.Alg() != method {
			return nil, fmt.Errorf("unexpected JWT token method: %s", t.Method.Alg())
		}
		return secret, nil
	})
	if err != nil {
		return nil, err
	}

	return &c, nil
}
