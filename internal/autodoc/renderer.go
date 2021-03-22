package autodoc

// Renderer is capable of rendering the documentation of a file
// in a special format.
type Renderer interface {
	// RenderFile renders the documentation of file
	// and returns it as a string.
	RenderFile(f File) (string, error)
}
