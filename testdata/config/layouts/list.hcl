layout "list" {
    displayName = "Liste"
    previewIcon = "../../../assets/icons/layout-list.svg"

    content = <<EOF
{{ if .Vars.header }}
<h2 data-id="header" {{ if .Vars.header_color }}style="color:{{ .Vars.header_color }}"{{ else }}style="color: #1080cf;"{{ end }}>{{ .Vars.header | html }}</h2>
{{ end }}
<ul data-id="content" {{ if .Vars.listStyle }}style="list-style: {{ .Vars.listStyle }}"{{ end }}>
{{ $animateItems := .Vars.animateItems }}
{{ range .Vars.items }}
    <li {{ if $animateItems }}class="fragment fade-left"{{ end }}>{{ . | html }}</li>
{{ end }}
</ul>
EOF
    description = "A simple layout with a header and content"

    variable "header" {
        type = string
        description = "The page header"
        multiline = true
        format = plain
        displayName = "Titel"
    }

    variable "header_color" {
        type = color
        description = "The header color"
        displayName = "Titel Farbe"
    }

    variable "items" {
        type = string
        multi = true
        description = "The list items to display"
        format = html
        displayName = "Liste"
    }

    variable "animateItems" {
        displayName = "Liste animieren"
        type = bool
        description = "Alle Einträge der Liste animieren"
    }
    
    variable "listStyle" {
        type = string
        description = "The list style type"
        displayName = "Listen-Style"
        choices = [
            "none",
            "circle",
            "default"
        ]
    }
}

