package autodoc

import "strings"

// Unindent removes common indention from all lines in text.
func Unindent(text string) string {
	lines := strings.Split(text, "\n")
	commonIndent := 1000

	for _, line := range lines {
		prefix := whitespacePrefixLen(line)
		if prefix < commonIndent && strings.TrimLeft(line, " \t") != "" {
			commonIndent = prefix
		}
	}

	for idx, line := range lines {
		if len(line) > commonIndent {
			lines[idx] = line[commonIndent:]
		}
	}

	return strings.Join(lines, "\n")
}

func whitespacePrefixLen(line string) int {
	for idx, c := range line {
		if c == ' ' || c == '\t' {
			continue
		}
		return idx
	}
	return len(line) - 1
}
