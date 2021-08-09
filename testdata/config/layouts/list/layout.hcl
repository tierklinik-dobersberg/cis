layout "list" {
    displayName = "Liste"
    previewIcon = "../../../../assets/icons/layout-list.svg"

    content = <<EOF
{{ if .Vars.header }}
<h2 data-id="header" style="color: #1080cf;">{{ .Vars.header | html }}</h2>
{{ end }}
<ul data-id="content" {{ if .Vars.listStyle }}style="list-style: {{ .Vars.listStyle }}"{{ end }}>
{{ range .Vars.items }}
    <li class="fragment fade-left">{{ . | html }}</li>
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

    variable "items" {
        type = string_list
        description = "The list items to display"
        format = html
        displayName = "Liste"
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

