package httpcond

import (
	"errors"
	"strings"

	"github.com/ppacher/system-conf/conf"
)

// Builder builds conditions by using condition types
// registered at a registry.
type Builder struct {
	reg *Registry
}

// NewBuilder creates a new builder that users reg.
func NewBuilder(reg *Registry) *Builder {
	return &Builder{
		reg: reg,
	}
}

// Build builds a new condition our of sec.
func (b *Builder) Build(sec conf.Section) (Condition, error) {
	b.reg.rw.RLock()
	defer b.reg.rw.RUnlock()

	// group all conditions values by condition type
	groups := make(map[string][]string)
	for _, t := range b.reg.providers {
		name := "Condition" + t.Name

		var values []string
		if t.Type.IsSliceType() {
			// get all values for name but only add them to groups
			// if it's actually used.
			values = sec.GetStringSlice(name)
			if len(values) == 0 {
				continue
			}
		} else {
			// get the value for name but skip it if it's not used.
			// Any ohter error (only-allowed-once) should be returned
			// to the caller.
			value, err := sec.GetString(name)
			if errors.Is(err, conf.ErrOptionNotSet) {
				continue
			}
			if err != nil {
				return nil, err
			}

			values = []string{value}
		}
		groups[strings.ToLower(t.Name)] = values
	}

	conds := make([]Condition, 0, len(groups))
	for name, values := range groups {
		t := b.reg.providers[name]

		if !t.Type.IsSliceType() {
			// this is not a slice so just build a single
			// condition instance and we're done.
			// There must be exactly one element here if we
			// didn't screw up the code above.
			conds = append(conds, buildInstance(t, values[0]))
		} else {
			// build condition instances for all values
			instances := make([]Condition, len(values))
			for idx, v := range values {
				instances[idx] = buildInstance(t, v)
			}

			// and concatinate them as defined into a single
			// final condition
			conds = append(conds, t.ConcatFunc(instances...))
		}
	}

	// finally, all conditions defined are ANDed by default.
	return NewAnd(conds...), nil
}

func buildInstance(t *Type, value string) Condition {
	// if the first character is a ! we need to negate the value
	if len(value) > 0 && value[0] == '!' {
		return NewNot(buildInstance(t, value[1:]))
	}

	// if the first character is a escaped ! remove the
	// escape character and build the condition
	if len(value) > 2 && value[0:1] == "\\!" {
		value = value[1:]
	}

	return &Instance{
		Type:  t,
		Value: value,
	}
}
