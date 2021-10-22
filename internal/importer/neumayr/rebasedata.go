package neumayr

import (
	"bytes"
	"fmt"
	"io"
	"io/ioutil"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
)

// Creates a new file upload http request with optional extra params
func newfileUploadRequest(uri string, params map[string]string, paramName, path string, f *os.File) (*http.Request, error) {
	if f == nil {
		file, err := os.Open(path)
		if err != nil {
			return nil, err
		}
		defer file.Close()

		f = file
	}

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile(paramName, filepath.Base(path))
	if err != nil {
		return nil, err
	}
	_, err = io.Copy(part, f)
	if err != nil {
		return nil, err
	}

	for key, val := range params {
		_ = writer.WriteField(key, val)
	}
	err = writer.Close()
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", uri, body)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	return req, err
}

// ConvertMDB converts the MDB file at filePath using RebaseData.
// It returns a File to a ZIP compresses version of the extracted and
// converted MDB file.
func ConvertMDB(mdb *os.File) (*os.File, error) {
	uri := "https://www.rebasedata.com/api/v1/convert?outputFormat=csv&errorResponse=zip"

	req, err := newfileUploadRequest(uri, nil, "files[]", mdb.Name(), mdb)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to perform request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("unexpected status code %d", resp.StatusCode)
	}

	tmpFile, err := ioutil.TempFile("", "mdb-conv-*.zip")
	if err != nil {
		return nil, fmt.Errorf("failed to create temporary file: %w", err)
	}

	if _, err := io.Copy(tmpFile, resp.Body); err != nil {
		return nil, fmt.Errorf("failed to save response: %w", err)
	}

	if _, err := tmpFile.Seek(0, 0); err != nil {
		return nil, fmt.Errorf("failed to seek back in response file: %w", err)
	}

	return tmpFile, nil
}
