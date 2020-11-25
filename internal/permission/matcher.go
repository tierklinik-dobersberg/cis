package permission

import (
	"context"
	"regexp"
	"strings"

	"github.com/tierklinik-dobersberg/logger"
	"github.com/tierklinik-dobersberg/userhub/pkg/models/v1alpha"
)

type Matcher struct {
	resolver *Resolver
}

// NewMatcher returns a new permission matcher.
func NewMatcher(resolver *Resolver) *Matcher {
	return &Matcher{resolver}
}

func (match *Matcher) Decide(ctx context.Context, req *Request) (bool, error) {
	permissions, err := match.resolver.ResolveUserPermissions(ctx, req.User)
	if err != nil {
		return false, err
	}

	for _, permSet := range permissions {
		isAllowed := false
		for _, perm := range permSet {
			if match.IsApplicable(req, &perm) {
				if strings.ToLower(perm.Effect) == "allow" {
					isAllowed = true
				} else {
					// default is deny and that's stronger than
					// allow so we can abort and return immediately.
					return false, nil
				}
			}
		}

		if isAllowed {
			return true, nil
		}
	}

	logger.From(ctx).WithFields(req.AsFields()).Info("No permission matched")
	return false, nil
}

// IsApplicable returns true if perm is applicable to be used for a
// decision on req.
func (match *Matcher) IsApplicable(req *Request, perm *v1alpha.Permission) bool {
	if !MatchNeedle(req.Domain, perm.Domains) {
		return false
	}
	if !MatchNeedle(req.Resource, perm.Resources) {
		return false
	}
	return true
}

func MatchNeedle(needle string, haystack []string) bool {
	// TODO(ppacher): add LRU cache
	for _, hay := range haystack {
		re, err := regexp.Compile(hay)
		if err != nil {
			logger.DefaultLogger().Errorf("failed to compile regexp %q: %s", hay, err)
			continue
		}

		if re.MatchString(needle) {
			return true
		}
	}
	return false
}
