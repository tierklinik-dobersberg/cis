package wiki

import (
	"strings"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/text"
)

// AnalyzeContent parsers the markdown formated content and extracts
// metadata like references to other documents.
// For document references that do not include a collection name
// currentCollection is used.
func AnalyzeContent(currentCollection string, content string, cmd *ContentMetadata) error {
	var err error

	gm := goldmark.New()
	p := gm.Parser()

	ctx := parser.NewContext()
	reader := text.NewReader(([]byte)(content))

	rootNode := p.Parse(reader, parser.WithContext(ctx))

	err = ast.Walk(rootNode, func(n ast.Node, entering bool) (ast.WalkStatus, error) {
		if n.Kind() != ast.KindLink || !entering {
			return ast.WalkContinue, nil
		}

		ref, ok := n.(*ast.Link)
		if !ok {
			// TODO(ppacher): what should we do here?
			return ast.WalkContinue, nil
		}

		u := string(ref.Destination)
		// skip anything that looks like an absolute URL
		if strings.Contains(u, "://") {
			return ast.WalkContinue, nil
		}

		splitted := strings.SplitN(u, "#", 2)
		// if we only have one value then we're referencing a document
		// in the same (current) collection.
		if len(splitted) == 1 {
			splitted = []string{
				currentCollection,
				splitted[0],
			}
		}

		// make sure path is absolute
		path := splitted[1]
		if !strings.HasSuffix(path, "/") {
			path = "/" + path
		}

		cmd.References = append(cmd.References, Reference{
			Collection: splitted[0],
			Path:       path,
		})

		return ast.WalkContinue, nil
	})

	return err
}
