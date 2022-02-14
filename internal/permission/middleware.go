package permission

import (
	"fmt"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/runtime/session"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
)

// SetType fines if one or all actions of a set
// must be permitted.
type SetType string

// The different set types.
const (
	And = SetType("and")
	Or  = SetType("or")
)

// Set defines a permission set.
type Set interface {
	// Type returns the set type. Either "and" or "or"
	Type() SetType
	// Actions returns all actions defined in the set.
	Actions() []*Action
}

// OneOf is a list of actions from which the session must
// be allowed at least one in order to be allowed to use
// the annotated API endpoint.
type OneOf []*Action

// Type implements Set.
func (oneof OneOf) Type() SetType { return Or }

// Actions implements Set.
func (oneof OneOf) Actions() []*Action { return ([]*Action)(oneof) }

// Union is a list of actions from which the session must
// be allowed all in order to be allowed to use
// the annotated API endpoint.
type Union []*Action

// Type implements Set.
func (union Union) Type() SetType { return And }

// Actions implements Set.
func (union Union) Actions() []*Action { return ([]*Action)(union) }

// Anyone defines that anyone can use the annotated API.
// It's equal to using a nil Set.
var Anyone = Set(nil)

// Require is a gin middleware that enforces
// permission requirements.
func Require(matcher *Matcher, set Set) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			ctx := c.Request().Context()
			ctx, sp := otel.Tracer("").Start(ctx, "permission.Require")
			defer sp.End()

			sess := session.Get(c)
			if sess == nil && set != nil && len(set.Actions()) > 0 {
				return httperr.Forbidden("no session")
			}

			if set != nil {
				for _, action := range set.Actions() {
					var resource string
					if action.ResourceName != nil {
						var err error
						resource, err = action.ResourceName(c)
						if err != nil {
							return err
						}
					}

					req := Request{
						Action:   action.Name,
						Resource: resource,
						User:     sess.User.Name,
					}

					sp.SetAttributes(
						attribute.String("tkd.permission.action", req.Action),
						attribute.String("tkd.permission.resource", resource),
						attribute.String("tkd.permission.user", req.User),
					)

					allowed, err := matcher.Decide(ctx, &req, sess.ExtraRoles())
					if err != nil {
						return httperr.InternalError().SetInternal(err)
					}

					if allowed && set.Type() == Or {
						return next(c)
					}

					if !allowed && set.Type() == And {
						return httperr.Forbidden(
							fmt.Sprintf("Not allowed to perform %s on %q", action.Name, resource),
						)
					}
				}

				if set.Type() == Or {
					return httperr.Forbidden("all actions declined")
				}
			}

			// If set.Type() == And and we reach this point than
			// all actions are allowed.
			return next(c)
		}
	}
}
