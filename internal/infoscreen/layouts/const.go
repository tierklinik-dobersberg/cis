package layouts

const (
	TypeString     = "dt:string"
	TypeStringList = "dt:stringlist"
	TypeNumber     = "dt:number"
	TypeBool       = "dt:bool"
	TypeImage      = "dt:image"
	TypeVideo      = "dt:video"
)

const (
	FormatMarkdown = "fmt:markdown"
	FormatHTML     = "fmt:html"
	FormatPlain    = "fmt:plain"
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
	case FormatHTML, FormatMarkdown, FormatPlain, "": // empty == plain
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
