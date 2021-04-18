package identitydb

import (
	"context"

	"github.com/tierklinik-dobersberg/cis/internal/cfgspec"
)

// Scope defines the access scope.
type Scope string

// A list of all available access scopes.
var (
	// Internal is the scope that should be used when accessing
	// user properties from within the CIS. Data retrieved with
	// this scope must never leave the system or be presented to
	// users otherwise.
	Internal = Scope("internal")
	// Private is the scope that should be used when data is loaded
	// on the users behave (like loading a users own profile to be
	// displayed to the user).
	Private = Scope("private")
	// Public is the scope that should be used when the data retrieved
	// is going to be displayed to a broader audience.
	Public = Scope("public")
)

var scopeKey = struct{ key string }{"user:scope"}

// WithScope adds the given scope to the returned context.
func WithScope(ctx context.Context, scope Scope) context.Context {
	return context.WithValue(ctx, scopeKey, scope)
}

// GetScope return the scope associated with ctx.
func GetScope(ctx context.Context) Scope {
	s := ctx.Value(scopeKey)
	if s == nil {
		return Public
	}

	if scope, ok := s.(Scope); ok {
		return scope
	}
	return Public
}

// FilterProperties applies the privacy settings to all user properties.
func FilterProperties(scope Scope, defs []cfgspec.UserPropertyDefinition, props map[string]interface{}) map[string]interface{} {
	if scope == Internal {
		return props
	}

	// build a lookup map for all defs.
	lm := make(map[string]cfgspec.UserPropertyDefinition)
	for _, spec := range defs {
		lm[spec.Name] = spec
	}

	cpy := make(map[string]interface{}, len(props))
	for key, value := range props {
		spec, ok := lm[key]
		if !ok {
			// there's no spec for this property. For security reasons, we treat
			// it as private.
			continue
		}

		switch spec.Visibility {
		case "internal":
			// If scope would be Internal we would have returned all
			// properties already.
			continue
		case "private":
			if scope != Private {
				continue
			}
			fallthrough
		case "public":
			cpy[key] = value
		default:
			// invalid visibility, we assume internal
		}
	}

	return cpy
}
