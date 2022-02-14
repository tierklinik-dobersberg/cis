package runtime

import "fmt"

// Must panics if err is non-nil.
func Must(err error) {
	if err != nil {
		panic(fmt.Sprintf("assertion failed: %s", err))
	}
}
