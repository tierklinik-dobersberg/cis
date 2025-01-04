package cfgspec

import (
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/runtime"
)

var (
	ConfigBuilder = runtime.NewConfigSchemaBuilder(
		addUISchema,
	)
	AddToSchema = ConfigBuilder.AddToSchema
)

// UISpec defines what configuration stanzas are supported.
var UISpec = conf.SectionSpec{
	{
		Name:        "HideUsersWithRole",
		Description: "A list or role names. All users that have one of the given roles are hidden from (most parts of) the UI",
		Type:        conf.StringSliceType,
		Annotations: new(conf.Annotation).With(
			runtime.OneOfRoles,
		),
	},
	{
		Name:        "UserPhoneExtensionProperties",
		Description: "A list of user properties that hold phone extensions and should be used to link from call log records to users",
		Type:        conf.StringSliceType,
		Annotations: new(conf.Annotation).With(
			runtime.OneOfRef("UserProperty", "Name", "Name"),
		),
	},
	{
		Name:        "CreateEventAlwaysAllowCalendar",
		Description: "A list of calendar IDs that should always be displayed/allowed when creating new events.",
		Type:        conf.StringSliceType,
	},
	{
		Name:    "OnCallRosterType",
		Type:    conf.StringType,
		Default: "Tierarzt",
	},
	{
		Name:    "OfftimeCommentScope",
		Type:    conf.StringType,
		Default: "offtime-requests",
	},
	{
		Name:    "ComputerAccountRole",
		Type:    conf.StringType,
		Default: "computer-accounts",
	},
	{
		Name:    "TaskCommentScope",
		Type:    conf.StringType,
		Default: "tasks",
	},
}

var RosterUISpec = conf.SectionSpec{
	{
		Name:        "AllowAnyUserAsOverwrite",
		Type:        conf.BoolType,
		Description: "Whether or not all users should be eligible for roster overwrites",
		Default:     "yes",
	},
	{
		Name:        "AllowPhoneNumberOverwrite",
		Type:        conf.BoolType,
		Description: "Whether or not overwritting the roster using direct phone-numbers should be allowed via the UI. This does not restrict API though.",
		Default:     "yes",
	},
}

// ExternalLinkSpec defines the configuration stanzas for an
// external link.
var ExternalLinkSpec = conf.SectionSpec{
	{
		Name:        "ParentMenu",
		Description: "The parent menu item",
		Type:        conf.StringType,
	},
	{
		Name:        "Text",
		Description: "The display text for the link",
		Type:        conf.StringType,
		Required:    true,
	},
	{
		Name:        "Icon",
		Description: "The name of the icon to display",
		Type:        conf.StringType,
	},
	{
		Name:        "Link",
		Description: "The target for the link",
		Type:        conf.StringType,
		Required:    true,
	},
	{
		Name:        "RequiresRole",
		Description: "The link requires one of the defined roles",
		Type:        conf.StringSliceType,
		Annotations: new(conf.Annotation).With(
			runtime.OneOfRoles,
		),
	},
	{
		Name:        "BlankTarget",
		Description: "Open link in a blank target",
		Type:        conf.BoolType,
	},
}

func addUISchema(schema *runtime.ConfigSchema) error {
	var categoryName = "User Interface"
	if err := schema.Register(
		runtime.Schema{
			Name:        "UI",
			DisplayName: "User Interface",
			Category:    categoryName,
			Description: "Configuration options that are used by the user interface",
			Spec:        UISpec,
			SVGData:     `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />`,
		},
		runtime.Schema{
			Name:        "ExternalLink",
			DisplayName: "Externe Links",
			Category:    categoryName,
			Description: "Additional links for the sidebar",
			Multi:       true,
			Spec:        ExternalLinkSpec,
			SVGData:     `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />`,
			Annotations: new(conf.Annotation).With(
				runtime.OverviewFields("Text", "ParentMenu"),
			),
		},
		runtime.Schema{
			Name:        "Roster",
			DisplayName: "Dienstplan",
			Category:    categoryName,
			Description: "User interface configuration for the duty roster",
			Spec:        RosterUISpec,
			SVGData:     `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />`,
		},
	); err != nil {
		return err
	}

	return nil
}

func init() {
	runtime.Must(
		AddToSchema(runtime.GlobalSchema),
	)
}
