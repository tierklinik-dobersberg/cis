package utils

import (
	"mime/multipart"

	"github.com/rogpeppe/go-internal/renameio"
)

// SaveUploadedFile saves an uploaded file at dst.
func SaveUploadedFile(file *multipart.FileHeader, dst string) error {
	src, err := file.Open()
	if err != nil {
		return err
	}
	defer src.Close()

	return renameio.WriteToFile(dst, src)
}
