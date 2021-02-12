package permission

import (
	"fmt"
	"strings"
	"sync"
)

// Action is a resource action and subject to
// permission checks.
type Action struct {
	// Name is the name of an action.
	Name string
	// Description is a short description of the action.
	Description string
	// valid guards against actions being created but
	// not registered in this package.
	valid bool
}

// Valid returns true if the action is valid.
func (action *Action) Valid() bool {
	return action.valid
}

var (
	actions     map[string]*Action
	actionsLock sync.RWMutex
)

// DefineAction defines a resource action that can be
// executed and is subject to permission checks.
func DefineAction(name, desc string) (*Action, error) {
	actionsLock.Lock()
	defer actionsLock.Unlock()

	lower := strings.ToLower(name)
	if _, ok := actions[lower]; ok {
		return nil, fmt.Errorf("action %q already defined", name)
	}

	action := &Action{
		Name:        name,
		Description: desc,
		valid:       true,
	}
	actions[lower] = action

	return action, nil
}

// MustDefineAction is like DefineAction but panics if name
// is already designed.
func MustDefineAction(name, desc string) *Action {
	a, err := DefineAction(name, desc)
	if err != nil {
		panic(err.Error())
	}

	return a
}

// ActionByName returns the action with the given name.
func ActionByName(name string) (*Action, error) {
	actionsLock.RLock()
	defer actionsLock.RUnlock()

	a, ok := actions[strings.ToLower(name)]
	if !ok {
		return nil, fmt.Errorf("unknown action %q", name)
	}
	return a, nil
}
