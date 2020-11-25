package permission_test

import (
	"testing"

	"github.com/tierklinik-dobersberg/userhub/internal/permission"
	"github.com/tierklinik-dobersberg/userhub/pkg/models/v1alpha"
)

func TestMatcher_IsApplicable(t *testing.T) {
	cases := []struct {
		r permission.Request
		p v1alpha.Permission
		a bool
	}{
		{
			permission.Request{
				User:     "admin",
				Domain:   "example.com",
				Resource: "/foo",
				Scheme:   "https",
			},
			v1alpha.Permission{
				Domains:   []string{".*"},
				Resources: []string{"foo$"},
			},
			true,
		},
	}

	for _, tc := range cases {
		m := new(permission.Matcher)

		result := m.IsApplicable(&tc.r, &tc.p)
		if result != tc.a {
			t.Fail()
		}
	}
}
