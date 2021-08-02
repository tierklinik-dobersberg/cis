package infoscreenapi

import (
	"context"
	"fmt"
	"html/template"
	"net/http"
	"net/url"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/infoscreen/layouts"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/pkg/multierr"
)

func RenderLayoutPreviewEndpoint(router *app.Router) {
	router.GET(
		"v1/layout/:layout/preview/*resource",
		permission.OneOf{
			ActionLayoutPreview,
		},
		func(ctx context.Context, app *app.App, c *gin.Context) error {
			lname := c.Param("layout")
			resource := strings.TrimPrefix(c.Param("resource"), "/")
			theme := c.Query("theme")
			background := c.Query("background")
			if theme == "" {
				theme = "white"
			}

			l, err := app.LayoutStore.Get(ctx, lname)
			if err != nil {
				return err
			}

			if strings.HasPrefix(resource, "uploaded/") {
				http.ServeFile(c.Writer, c.Request, filepath.Join(
					app.Config.InfoScreenConfig.UploadDataDirectory,
					strings.TrimPrefix(resource, "uploaded/"),
				))
				return nil
			}

			vars, err := parseLayoutVars(l, c.Request.URL.Query())
			if err != nil {
				return err
			}

			content, err := layouts.Render(l, vars)
			if err != nil {
				return err
			}

			return rendererPlayer(&PlayContext{
				ShowName: "preview",
				Embedded: true,
				Theme:    theme,
				Slides: []PlaySlide{
					{
						Content:    template.HTML(content),
						Background: background,
					},
				},
			}, c.Writer)
		},
	)
}

func parseLayoutVars(l *layouts.Layout, query url.Values) (layouts.Vars, error) {
	errors := new(multierr.Error)

	vars := layouts.Vars{}
	for key, values := range query {
		def := l.Var(key)
		if def == nil {
			// we do allow unknown query parameters as they might control
			// different behavior and are not meant as layout-vars
			continue
		}

		if len(values) != 1 && def.Type != layouts.TypeStringList {
			errors.Addf("query parameter %s only allowed once", key)
			continue
		}

		var (
			val interface{}
			err error
		)
		switch def.Type {
		case layouts.TypeBool:
			val, err = strconv.ParseBool(values[0])
		case layouts.TypeString:
			val, _ = url.QueryUnescape(values[0])
		case layouts.TypeStringList:
			val = values
		case layouts.TypeNumber:
			val, err = strconv.ParseFloat(values[0], 64)
		case layouts.TypeImage, layouts.TypeVideo:
			val = values[0]
		default:
			err = fmt.Errorf("unsupported variable type %s", def.Type)
		}
		if err != nil {
			errors.Add(err)
			continue
		}

		vars[key] = val
	}
	return vars, errors.ToError()
}
