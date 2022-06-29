package tmpl2pdf

import (
	"bytes"
	"context"
	"errors"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"strings"
)

func addOption(w *multipart.Writer, option string) error {
	return w.WriteField("option", option)
}

func addFile(w *multipart.Writer, filename string) error {
	writer, err := w.CreateFormFile("file", filename)
	if err != nil {
		return err
	}
	file, err := os.Open(filename)
	if err != nil {
		return err
	}
	defer file.Close()
	_, err = io.Copy(writer, file)

	return err
}

func ConvertURLToPDF(ctx context.Context, cli *http.Client, serverURL string, args ...string) (io.ReadCloser, error) {
	var err error

	// prepare request
	var postBuf bytes.Buffer
	w := multipart.NewWriter(&postBuf)
	for _, arg := range args {
		if arg == "-" {
			return nil, errors.New("stdin/stdout input is not implemented")
		} else if strings.HasPrefix(arg, "-") {
			err = addOption(w, arg)
		} else if strings.HasPrefix(arg, "https://") {
			err = addOption(w, arg)
		} else if strings.HasPrefix(arg, "http://") {
			err = addOption(w, arg)
		} else if strings.HasPrefix(arg, "file://") {
			err = addFile(w, arg[7:])
		} else if _, err = os.Stat(arg); err == nil {
			// TODO: better way to detect file arguments
			err = addFile(w, arg)
		} else {
			err = addOption(w, arg)
		}

		if err != nil {
			return nil, err
		}
	}
	w.Close()

	// trunk-ignore(golangci-lint/gosec)
	req, _ := http.NewRequestWithContext(ctx, "POST", serverURL, &postBuf)
	req.Header.Set("Content-Type", w.FormDataContentType())

	resp, err := cli.Do(req)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, errors.New("server error, consult server log for details")
	}

	return resp.Body, nil
}
