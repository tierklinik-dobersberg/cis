package infoscreenapi

import (
	"bytes"
	"context"
	"encoding/json"
	"html/template"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/infoscreen/layouts"
	"github.com/tierklinik-dobersberg/cis/internal/permission"
	"github.com/tierklinik-dobersberg/cis/internal/utils"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/pkg/models/infoscreen/v1alpha"
	"github.com/tierklinik-dobersberg/cis/runtime/session"
)

type slidePreview struct {
	Content string
}

func RenderLayoutPreviewEndpoint(router *app.Router) {
	router.POST(
		"v1/preview",
		permission.OneOf{
			ActionShowsRead,
			ActionShowsWrite,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			sess := session.Get(c)
			if sess == nil {
				return httperr.InternalError("missing session")
			}

			var slide v1alpha.Slide
			if err := json.NewDecoder(c.Request().Body).Decode(&slide); err != nil {
				return err
			}
			key, err := utils.Nonce(32)
			if err != nil {
				return err
			}

			theme := c.QueryParam("theme")
			if theme == "" {
				theme = "white"
			}

			l, err := app.LayoutStore.Get(ctx, slide.Layout)
			if err != nil {
				return err
			}
			content, err := layouts.Render(l, slide.Vars, &layouts.RenderContext{
				Preview:  true,
				Embedded: true,
			})
			if err != nil {
				return err
			}

			var buf = new(bytes.Buffer)

			playCtx := &PlayContext{
				ShowName: "preview",
				Embedded: true,
				Theme:    theme,
				Slides: []PlaySlide{
					{
						Content:     template.HTML(content),
						AutoAnimate: slide.AutoAnimate,
						Background:  slide.Background,
					},
				},
			}
			if err := playTemplate.Execute(buf, playCtx); err != nil {
				return err
			}
			entry := &slidePreview{
				Content: buf.String(),
			}
			if err := sess.SetEphemeral(ctx, key, entry, time.Minute); err != nil {
				return err
			}
			c.JSON(http.StatusOK, gin.H{
				"key": key,
			})
			return nil
		},
	)

	router.GET(
		"v1/preview/:key/*resource",
		permission.OneOf{
			ActionShowsWrite,
			ActionShowsRead,
		},
		func(ctx context.Context, app *app.App, c echo.Context) error {
			resource := strings.TrimPrefix(c.Param("resource"), "/")

			key := c.Param("key")
			sess := session.Get(c)
			if sess == nil {
				return httperr.InternalError("missing session")
			}

			var slide slidePreview
			ttl, err := sess.GetEphemeral(ctx, key, &slide)
			if err != nil {
				return err
			}
			if ttl.IsZero() {
				return httperr.NotFound("slide-preview", key)
			}

			if strings.HasPrefix(resource, "uploaded/") {
				c.File(filepath.Join(
					app.Config.InfoScreenConfig.UploadDataDirectory,
					strings.TrimPrefix(resource, "uploaded/"),
				))
				return nil
			}

			c.Response().Header().Set("Content-Type", "text/html; charset=utf-8")
			_, err = c.Response().Write([]byte(slide.Content))
			return err
		},
	)
}

/*
func parseLayoutVars(l *layouts.Layout, query url.Values) (layouts.Vars, error) {
	errors := new(multierr.Error)

	vars := layouts.Vars{}
L:
	for key, values := range query {
		def := l.Var(key)
		if def == nil {
			// we do allow unknown query parameters as they might control
			// different behavior and are not meant as layout-vars
			continue
		}

		if len(values) != 1 && !def.Multi {
			errors.Addf("query parameter %s only allowed once", key)
			continue
		}

		var val interface{}
		if def.Multi {
			var res []interface{}
			for idx, sv := range values {
				v, err := decodeVariable(def, sv)
				if err != nil {
					errors.Add(fmt.Errorf("index %d: %w", idx, err))
					continue L
				}
				res = append(res, v)
			}
			val = res
		} else {
			var err error
			val, err = decodeVariable(def, values[0])
			if err != nil {
				errors.Add(err)
				continue
			}
		}

		vars[key] = val
	}
	return vars, errors.ToError()
}

func decodeVariable(def *layouts.Variable, value string) (interface{}, error) {
	var (
		val interface{}
		err error
	)
	switch def.Type {
	case layouts.TypeBool:
		val, err = strconv.ParseBool(value)
	case layouts.TypeString, layouts.TypeColor:
		val, _ = url.QueryUnescape(value)
	case layouts.TypeNumber:
		val, err = strconv.ParseFloat(value, 64)
	case layouts.TypeImage, layouts.TypeVideo:
		val = value
	default:
		err = fmt.Errorf("unsupported variable type %s", def.Type)
	}
	return val, err
}
*/
