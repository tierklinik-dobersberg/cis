package utils

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"time"
)

// Nonce returns a random nonce of the given size
func Nonce(size int) (string, error) {
	nonce := make([]byte, size)
	_, err := rand.Read(nonce)
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("%x", nonce), nil
}

// Signature returns a signature for the given parts
func Signature(secret string, parts ...string) string {
	hash := hmac.New(sha256.New, []byte(secret))
	for _, p := range parts {
		_, _ = hash.Write([]byte(p))
	}

	return base64.StdEncoding.EncodeToString(hash.Sum(nil))
}

// VerifySignature verifies if signature matches the signature of
// parts with secret.
func VerifySignature(signature, secret string, parts ...string) bool {
	expectedSig := Signature(secret, parts...)
	return signature == expectedSig
}

// Midnight returns a new time that represents midnight at t.
func Midnight(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
}
