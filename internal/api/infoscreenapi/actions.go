package infoscreenapi

import (
	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
)

var (
	ActionUploadFiles = permission.MustDefineAction(
		"infoscreen:upload",
		"Permission required to upload files",
		func(c *gin.Context) (string, error) {
			return c.Param("layout"), nil
		},
	)
	ActionShowsRead = permission.MustDefineAction(
		"infoscreen:shows:read",
		"Permission required to read shows",
		func(c *gin.Context) (string, error) {
			return c.Param("show"), nil
		},
	)
	ActionShowsWrite = permission.MustDefineAction(
		"infoscreen:shows:write",
		"Permission required to write shows",
		func(c *gin.Context) (string, error) {
			return c.Param("show"), nil
		},
	)
	ActionShowsDelete = permission.MustDefineAction(
		"infoscreen:shows:delete",
		"Permission required to delete shows",
		func(c *gin.Context) (string, error) {
			return c.Param("show"), nil
		},
	)
)
