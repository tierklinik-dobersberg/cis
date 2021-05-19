package cctv

import (
	"context"

	"github.com/gin-gonic/gin"
)

type Source interface {
	// Attach should attach the request from c to the
	// camera source. Attach can assume that no data or
	// headers have been written to c yet.
	Attach(ctx context.Context, c *gin.Context) error
}
