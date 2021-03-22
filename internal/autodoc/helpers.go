package autodoc

import "strings"

func Unindent(text string) string {
	lines := strings.Split(text, "\n")
	commonIndent := 1000

	for _, line := range lines {
		prefix := countWhitePrefix(line)
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

func countWhitePrefix(line string) int {
	for idx, c := range line {
		if c == ' ' || c == '\t' {
			continue
		}
		return idx
	}
	return len(line) - 1
}
