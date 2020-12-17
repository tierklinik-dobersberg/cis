package permission_test

import (
	"context"
	"testing"

	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/internal/schema"
	"github.com/tierklinik-dobersberg/cis/pkg/models/v1alpha"
)

func TestMatcher_IsApplicable(t *testing.T) {
	cases := []struct {
		r permission.Request
		p schema.Permission
		a bool
	}{
		{
			permission.Request{
				User:     "admin",
				Domain:   "example.com",
				Resource: "/foo",
				Scheme:   "https",
			},
			schema.Permission{
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
