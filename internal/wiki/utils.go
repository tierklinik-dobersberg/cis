package wiki

import (
	"errors"
	"net/url"
	"path"
	"strings"
)

var (
	errPathMissing            = errors.New("document path must be set")
	errPathNotAbsolute        = errors.New("document paths must be absolute")
	errPathSlashSuffix        = errors.New("document paths must not end in a path separator")
	errMissingTitle           = errors.New("document title must be set")
	errMissingCollectionName  = errors.New("collection name must be set")
	errInvalidImageURL        = errors.New("collection has invalid image url")
	errUnsupportedImageScheme = errors.New("collection image url has unsupported scheme")
)

// ValidateDocumentPath checks if path is a valid document
// path.
func ValidateDocumentPath(docPath string) error {
	if docPath == "" {
		return errPathMissing
	}

	if !path.IsAbs(docPath) {
		return errPathNotAbsolute
	}

	if strings.HasSuffix(docPath, "/") {
		return errPathSlashSuffix
	}

	return nil
}

// ValidateDocument makes sure doc is valid.
func ValidateDocument(doc Document) error {
	if err := ValidateDocumentPath(doc.Path); err != nil {
		return err
	}

	if doc.Collection == "" {
		return errMissingCollectionName
	}

	if doc.Title == "" {
		return errMissingTitle
	}

	return nil
}

// ValidateCollection makes sure col is valid.
func ValidateCollection(col Collection) error {
	if col.Name == "" {
		return errMissingCollectionName
	}

	if col.ImageURL != "" {
		u, err := url.Parse(col.ImageURL)
		if err != nil {
			return errInvalidImageURL
		}

		switch u.Scheme {
		case "http", "https", "data":
		default:
			return errUnsupportedImageScheme
		}
	}

	return nil
}
