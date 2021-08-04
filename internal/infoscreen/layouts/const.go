package layouts

const (
	TypeString     = "string"
	TypeStringList = "stringlist"
	TypeNumber     = "number"
	TypeBool       = "bool"
	TypeImage      = "image"
	TypeVideo      = "video"
)

const (
	FormatMarkdown = "markdown"
	FormatHTML     = "html"
	FormatPlain    = "plain"
)

func IsKnownType(d string) bool {
	switch d {
	case TypeBool, TypeNumber, TypeString, TypeStringList, TypeImage, TypeVideo:
		return true
	}
	return false
}

func IsKnownFormat(f string) bool {
	switch f {
	case FormatHTML, FormatMarkdown, FormatPlain:
		return true
	}
	return false
}

func RequiresUpload(varType string) bool {
	switch varType {
	case TypeImage, TypeVideo:
		return true
	}
	return false
}
