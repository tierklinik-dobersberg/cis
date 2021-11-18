package permission_test

import (
	"context"
	"testing"

	"github.com/tierklinik-dobersberg/cis/internal/cfgspec"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/models/identity/v1alpha"
)

func TestMatcher_IsApplicable(t *testing.T) {
	t.Parallel()

	cases := []struct {
		r permission.Request
		p cfgspec.Permission
		a bool
	}{
		{
			permission.Request{
				User:     "admin",
				Resource: "/foo",
			},
			cfgspec.Permission{
				Permission: v1alpha.Permission{
					Domains:   []string{".*"},
					Resources: []string{"foo$"},
				},
			},
			true,
		},
	}

	for _, tc := range cases {
		m := new(permission.Matcher)

		result := m.IsApplicable(context.TODO(), &tc.r, &tc.p)
		if result != tc.a {
			t.Fail()
		}
	}
}
