package cfgspec

import (
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/runtime"
)

var (
	ConfigBuilder = runtime.NewConfigSchemaBuilder(
		addUISchema,
		addUserProperty,
	)
	AddToSchema = ConfigBuilder.AddToSchema
)

// UI groups settings that only relate to the user
// interface and are not directly used by cisd.
// Values here are made available through
// /api/config/v1/ui.
type UI struct {
	HideUsersWithRole              []string
	UserPhoneExtensionProperties   []string
	CreateEventAlwaysAllowCalendar []string
}

// UISpec defines what configuration stanzas are supported.
var UISpec = conf.SectionSpec{
	{
		Name:        "HideUsersWithRole",
		Description: "A list or role names. All users that have one of the given roles are hidden from (most parts of) the UI",
		Type:        conf.StringSliceType,
	},
	{
		Name:        "UserPhoneExtensionProperties",
		Description: "A list of user properties that hold phone extensions and should be used to link from call log records to users",
		Type:        conf.StringSliceType,
	},
	{
		Name:        "CreateEventAlwaysAllowCalendar",
		Description: "A list of calendar IDs that should always be displayed/allowed when creating new events.",
		Type:        conf.StringSliceType,
	},
}

type RosterUIConfig struct {
	EligibleRolesForOverwrite []string
	AllowAnyUserAsOverwrite   bool
	AllowPhoneNumberOverwrite bool
}

var RosterUISpec = conf.SectionSpec{
	{
		Name:        "EligibleRolesForOverwrite",
		Type:        conf.StringSliceType,
		Description: "A list of role names that are eligible for roster overwrites",
	},
	{
		Name:        "AllowAnyUserAsOverwrite",
		Type:        conf.BoolType,
		Description: "Whether or not all users should be eligible for roster overwrites. if true, EligibleRolesForOverwrite will be used as a preference only.",
		Default:     "yes",
	},
	{
		Name:        "AllowPhoneNumberOverwrite",
		Type:        conf.BoolType,
		Description: "Whether or not overwritting the roster using direct phone-numbers should be allowed via the UI. This does not restrict API though.",
		Default:     "yes",
	},
}

// ExternalLink defines an external link to be displayed in the
// user interface.
type ExternalLink struct {
	ParentMenu   string
	Text         string
	Icon         string
	Link         string
	BlankTarget  bool
	RequiresRole []string
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
	},
	{
		Name:        "BlankTarget",
		Description: "Open link in a blank target",
		Type:        conf.BoolType,
	},
}

type KnownPhoneExtension struct {
	ExtensionNumber string
	DisplayName     string
}

var KnownPhoneExtensionSpec = conf.SectionSpec{
	{
		Name:        "ExtensionNumber",
		Description: "The phone extension to match",
		Type:        conf.StringType,
		Required:    true,
	},
	{
		Name:        "DisplayName",
		Description: "The name to display in the UI",
		Type:        conf.StringType,
		Required:    true,
	},
}

// QuickRosterOverwrite defines a "quick-settings" button to
// configure a roster overwrite.
type QuickRosterOverwrite struct {
	DisplayName  string
	TargetNumber string
}

// QuickRosterOverwriteSpec defines the configuration stanzas
// for a quick-roster overwrite definition.
var QuickRosterOverwriteSpec = conf.SectionSpec{
	{
		Name:        "DisplayName",
		Type:        conf.StringType,
		Description: "The display name for the quick-overwrite",
		Required:    true,
	},
	{
		Name:        "TargetNumber",
		Type:        conf.StringType,
		Description: "Target phone number or extension",
		Required:    true,
	},
}

// TriggerAction defines a custom trigger action that can be executed via the user
// interface.
type TriggerAction struct {
	Name           string
	PrimaryTrigger string
	TriggerGroup   []string
	ActionText     string
	PendingText    string
}

// TriggerActionSpec defines the configuration spec that can be used for the custom
// trigger actions.
var TriggerActionSpec = conf.SectionSpec{
	{
		Name:        "Name",
		Description: "The name of the action",
		Type:        conf.StringType,
	},
	{
		Name:        "PrimaryTrigger",
		Description: "The name of the primary trigger used to detect if the action is already pending.",
		Type:        conf.StringType,
	},
	{
		Name:        "TriggerGroup",
		Description: "The name of the trigger group to execute. If set, PrimaryTrigger is expected to be part of the group",
		Type:        conf.StringSliceType,
	},
	{
		Name:        "ActionText",
		Description: "The text for the action button",
		Type:        conf.StringType,
	},
	{
		Name:        "PendingText",
		Description: "The text to display if the trigger is already pending.",
		Type:        conf.StringType,
	},
}

func addUISchema(schema *runtime.ConfigSchema) error {
	if err := schema.Register(
		runtime.Schema{
			Name:        "UI",
			DisplayName: "User Interface",
			Description: "Configuration options that are used by the user interface",
			Spec:        UISpec,
			SVGData:     `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />`,
		},
		runtime.Schema{
			Name:        "ExternalLink",
			DisplayName: "Externe Links",
			Description: "Additional links for the sidebar",
			Multi:       true,
			Spec:        ExternalLinkSpec,
			SVGData:     `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />`,
		},
		runtime.Schema{
			Name:        "QuickRosterOverwrite",
			DisplayName: "Zusätzliche Umleitungen",
			Description: "Quick settings for roster overwrites",
			Spec:        QuickRosterOverwriteSpec,
			Multi:       true,
			SVGData:     `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />`,
		},
		runtime.Schema{
			Name:        "TriggerAction",
			DisplayName: "Benutzerdefinierte Aktionen",
			Description: "Define actions that can be triggered via the user interface",
			Spec:        TriggerActionSpec,
			Multi:       true,
			SVGData:     `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />`,
		},
		runtime.Schema{
			Name:        "KnownPhoneExtension",
			DisplayName: "Bennenung Telefondurchwahl",
			Description: "Additional phone-number to name mappings",
			Spec:        KnownPhoneExtensionSpec,
			Multi:       true,
			SVGData:     `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />`,
		},
		runtime.Schema{
			Name:        "Roster",
			DisplayName: "Dienstplan",
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
