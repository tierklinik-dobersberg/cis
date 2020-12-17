package loader

// Loader loads user and group definitions from the file system.
type Loader struct {
	dir string
}

// New returns a new loader that uses the given paths
// as it's search roots.
func New(path string) *Loader {
	return &Loader{
		dir: path,
	}
}
