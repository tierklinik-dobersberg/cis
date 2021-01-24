package textparse

import (
	"context"
	"fmt"
	"strings"
)

// PhoneNumber parses text as a phone number and tries to
// support a very lazy format of writting telephone numbers.
func PhoneNumber(ctx context.Context, text string) ([]string, error) {
	allowedRunes := "1234567890+-/ "

	if text == "" {
		return nil, nil
	}

	var start int = -1
	var end int = -1

	for i, r := range ([]rune)(text) {
		if strings.ContainsRune(allowedRunes, r) {
			if end != -1 {
				return nil, fmt.Errorf("found valid characters outside of number scope")
			}
			if start == -1 {
				start = i
			}
		} else {
			if end == -1 {
				end = i
			}
		}
	}

	if end == -1 || start == -1 {
		return nil, fmt.Errorf("failed to find valid part")
	}

	part := strings.Trim(text[start:end], " ")
	part = strings.ReplaceAll(part, "/", "")
	part = strings.ReplaceAll(part, "-", "")

	parts := strings.Fields(part)

	return parts, nil
}
