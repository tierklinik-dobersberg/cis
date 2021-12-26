package utils

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
)

// Nonce returns a random nonce of the given size encoded as hex.
func Nonce(size int) (string, error) {
	nonce := make([]byte, size)
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}

	return hex.EncodeToString(nonce), nil
}

// Signature returns a signature for the given parts.
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
