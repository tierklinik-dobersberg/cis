package passwd

import (
	"context"
	"crypto/subtle"
	"errors"

	"golang.org/x/crypto/bcrypt"
)

func init() {
	Register("plain", func(_ context.Context, _, hash, plaintext string) (bool, error) {
		return subtle.ConstantTimeCompare([]byte(hash), []byte(plaintext)) == 1, nil
	})

	Register("bcrypt", func(_ context.Context, _, hash, plaintext string) (bool, error) {
		err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(plaintext))

		if err == nil {
			return true, nil
		}

		if errors.Is(err, bcrypt.ErrMismatchedHashAndPassword) {
			return false, nil
		}

		return false, err
	})
}
