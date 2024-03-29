package infoscreenapi

import (
	"bytes"
	"context"
	"html/template"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/infoscreen/layouts"
	"github.com/tierklinik-dobersberg/cis/pkg/httperr"
	"github.com/tierklinik-dobersberg/cis/runtime"
	"github.com/tierklinik-dobersberg/logger"
)

const playTemplateContent = `
{{ $preview := .Preview }}
<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8">
		<title>{{ .ShowName }}</title>
		<link rel="stylesheet" href="https://unpkg.com/reveal.js@4.1.3/dist/reset.css">
		<link rel="stylesheet" href="https://unpkg.com/reveal.js@4.1.3/dist/reveal.css">
		<link rel="stylesheet" href="https://unpkg.com/reveal.js@4.1.3/dist/theme/{{ .Theme }}.css">
		<script language="javascript" src="https://unpkg.com/reveal.js@4.1.3/dist/reveal.js"></script>
		<style>
		section {
			display: flex;
			flex-direction: column;
			justify-content: center;
			align-items: center;
		}
{{ if .Embedded }}
		.reveal {
			height: 100vh;
			width: 100vw;
		}
{{ end }}
		</style>
		<script>
		function start() {
			Reveal.initialize({
				loop: true,
				{{ if not $preview }}autoSlide: 5000,{{ end }}
				{{ if $preview }}
				controls: false,
				progress: false,
				{{end}}
				display: 'flex',
				margin: 0,
				{{ if .Embedded }}embedded: true,{{ end }}
			});
		}
		</script>
	</head>
	<body onload="javascript:start()">

		<div class="reveal">
			<div class="slides">
{{ range .Slides }}
<section
	{{ if .Duration }}data-autoslide="{{ .Duration }}"{{ end }}
	{{ if and .AutoAnimate (not $preview) }}data-auto-animate data-auto-animate-id="{{ .AutoAnimate }}"{{ end }}
	{{ if .Background }}data-background-color="{{ .Background }}"{{ end }}
	>
		{{ .Content }}
</section>
{{ end }}
			</div>
		</div>
	</body>
</html>
`

var playTemplate *template.Template

func init() {
	var err error
	playTemplate, err = template.New("player").Parse(playTemplateContent)
	runtime.Must(err)
}

type PlaySlide struct {
	Duration    float64
	Content     template.HTML
	AutoAnimate string
	Background  string
}

type PlayContext struct {
	ShowName  string
	Embedded  bool
	Theme     string
	Slides    []PlaySlide
	AutoSlide bool
	Preview   bool
}

func renderPlayer(playCtx *PlayContext, w http.ResponseWriter) error {
	buf := new(bytes.Buffer)
	if err := playTemplate.Execute(buf, playCtx); err != nil {
		return err
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, err := w.Write(buf.Bytes())

	return err
}

// trunk-ignore(golangci-lint/cyclop)
func PlayShowEndpoint(router *app.Router) {
	router.GET(
		"v1/shows/:show/play/*resource",
		func(ctx context.Context, app *app.App, c echo.Context) error {
			// TODO(ppacher): add authorization
			log := logger.From(ctx)

			showName := c.Param("show")
			isEmbedded := c.QueryParam("embedded") != ""
			theme := c.QueryParam("theme")

			previewIndex := -1
			if previewStr := c.QueryParam("preview"); previewStr != "" {
				if idx, err := strconv.ParseInt(previewStr, 0, 0); err == nil {
					previewIndex = int(idx)
				} else {
					log.Errorf("invalid parameter for preview: %q (error=%s)", previewStr, err)
				}
			}

			// handle resource requests
			resource := strings.TrimPrefix(c.Param("resource"), "/")
			if strings.HasPrefix(resource, "uploaded/") {
				// TODO(ppacher): verify the show actually has a field
				// that allows this resource!
				path := strings.TrimPrefix(resource, "uploaded/")

				return c.File(filepath.Join(
					app.Config.InfoScreenConfig.UploadDataDirectory,
					path,
				))
			} else if resource != "" {
				return httperr.NotFound("asset", resource)
			}

			show, err := app.InfoScreenShows.GetShow(ctx, showName)
			if err != nil {
				return err
			}

			if theme == "" {
				theme = show.Theme
				if theme == "" {
					theme = "white"
				}
			}

			playCtx := &PlayContext{
				ShowName: showName,
				Embedded: isEmbedded,
				Theme:    theme,
				Preview:  previewIndex >= 0,
			}
			for idx, slide := range show.Slides {
				if previewIndex >= 0 && idx != previewIndex {
					continue
				}

				l, err := app.LayoutStore.Get(ctx, slide.Layout)
				if err != nil {
					log.Errorf("failed to get layout %s: %s", slide.Layout, err)

					continue
				}

				var content []byte
				content, err = layouts.Render(l, slide.Vars, &layouts.RenderContext{
					Preview:  previewIndex >= 0,
					Embedded: isEmbedded,
				})
				if err != nil {
					log.Errorf("failed to render layout %s: %s", slide.Layout, err)

					continue
				}

				playCtx.Slides = append(playCtx.Slides, PlaySlide{
					Duration: slide.Duration.Seconds() * float64(1000),
					// trunk-ignore(golangci-lint/gosec)
					Content:     template.HTML(content),
					AutoAnimate: slide.AutoAnimate,
					Background:  slide.Background,
				})
			}

			return renderPlayer(playCtx, c.Response())
		},
	)
}
