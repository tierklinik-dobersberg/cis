package utils

import "context"

// ContextUserKey is used to add the session use to a request context.
type ContextUserKey struct{}

// GetUser returns the username associated with ctx.
func GetUser(ctx context.Context) string {
	v, _ := ctx.Value(ContextUserKey{}).(string)
	return v
}
