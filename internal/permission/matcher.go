package permission

import (
	"regexp"

	"github.com/tierklinik-dobersberg/logger"
	"github.com/tierklinik-dobersberg/userhub/pkg/models/v1alpha"
)

type Matcher struct{}

// IsApplicable returns true if perm is applicable to be used for a
// decision on req.
func (match *Matcher) IsApplicable(req *Request, perm *v1alpha.Permission) bool {
	if !MatchNeedle(req.Domain, perm.Domains) {
		return false
	}
	if !MatchNeedle(req.Resource, perm.Resources) {
		return false
	}
	if !MatchNeedle(req.User, perm.Subjects) {
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
