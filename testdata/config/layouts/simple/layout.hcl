layout "simple" {
    content = <<EOF
{{ if .Vars.header }}
<h2 data-id="header" style="color: #1080cf;">{{ .Vars.header | html }}</h2>
{{ end }}
{{ if .Vars.content }}
<div class="content" data-id="content">
    {{ .Vars.content | html }}
</div>
{{ end }}
{{ if .Vars.image }}
<img src="{{ .Vars.image }}">
{{ end }}
EOF
    description = "A simple layout with a header and content"

    variable "header" {
        type = string
        description = "The page header"
        format = plain
    }

    variable "content" {
        type = string
        description = "The actual page content"
        format = html
    }

    variable "image" {
        type = image
        description = "An optional image to display"
    }
}
