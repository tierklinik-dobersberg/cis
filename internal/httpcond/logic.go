package httpcond

import "net/http"

// And is a simple condition that represents a boolean
// AND between Left and Right.
type And struct {
	Left  Condition
	Right Condition
}

// NewAnd returns a new and condition.
func NewAnd(left, right Condition) *And {
	return &And{
		Left:  left,
		Right: right,
	}
}

// Match implements Condition.
func (and *And) Match(req *http.Request) (bool, error) {
	ok, err := and.Left.Match(req)
	if err != nil {
		return false, err
	}

	if !ok {
		return false, nil
	}

	ok, err = and.Right.Match(req)
	if err != nil {
		return false, err
	}

	return ok, nil
}

// Or is a simple condition that represents a boolean
// OR between Left and Right
type Or struct {
	Left  Condition
	Right Condition
}

// NewOr returns a new or condition.
func NewOr(left, right Condition) *Or {
	return &Or{
		Left:  left,
		Right: right,
	}
}

// Match implements Condition.
func (or *Or) Match(req *http.Request) (bool, error) {
	ok, err := or.Left.Match(req)
	if err != nil {
		return false, err
	}
	if ok {
		return true, nil
	}

	ok, err = or.Right.Match(req)
	if err != nil {
		return false, err
	}

	return ok, nil
}

// Not is a simple condition that represents a boolean
// NOT on What.
type Not struct {
	What Condition
}

// NewNot returns a new not condition.
func NewNot(c Condition) *Not {
	return &Not{
		What: c,
	}
}

// Match implements Condition.
func (not *Not) Match(req *http.Request) (bool, error) {
	ok, err := not.What.Match(req)
	if err != nil {
		return false, err
	}

	return !ok, nil
}
