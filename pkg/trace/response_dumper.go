package trace

import (
	"bytes"
	"io"
	"net/http"

	"github.com/labstack/echo/v4"
)

// ResponseRecorder can record a labstack/echo response body.
type ResponseRecorder struct {
	http.ResponseWriter

	mw  io.Writer
	buf *bytes.Buffer
}

// New ResponseRecorder returns a new response recorder that stores
// the body written to resp.
func NewResponseRecorder(resp *echo.Response) *ResponseRecorder {
	buf := new(bytes.Buffer)

	return &ResponseRecorder{
		ResponseWriter: resp.Writer,

		mw:  io.MultiWriter(resp.Writer, buf),
		buf: buf,
	}
}

// Write proxies calls to the actual *echo.Response and a
// buffer.
func (d *ResponseRecorder) Write(b []byte) (int, error) {
	return d.mw.Write(b)
}

// GetResponse returns the response recorded in d.
func (d *ResponseRecorder) GetResponse() string {
	return d.buf.String()
}
