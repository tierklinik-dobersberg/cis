package cfgspec

import (
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/runtime"
)

var (
	ConfigBuilder = runtime.NewConfigSchemaBuilder(addUISchema)
	AddToSchema   = ConfigBuilder.AddToSchema

	uiCategory = "User Interface"
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
			Description: "Configuration options that are used by the user interface",
			Spec:        UISpec,
			Category:    uiCategory,
		},
		runtime.Schema{
			Name:        "ExternalLink",
			Description: "Additional links for the sidebar",
			Multi:       true,
			Spec:        ExternalLinkSpec,
			Category:    uiCategory,
		},
		runtime.Schema{
			Name:        "QuickRosterOverwrite",
			Description: "Quick settings for roster overwrites",
			Spec:        QuickRosterOverwriteSpec,
			Multi:       true,
			Category:    uiCategory,
		},
		runtime.Schema{
			Name:        "TriggerAction",
			Description: "Define actions that can be triggered via the user interface",
			Spec:        TriggerActionSpec,
			Multi:       true,
			Category:    uiCategory,
		},
		runtime.Schema{
			Name:        "KnownPhoneExtension",
			Description: "Additional phone-number to name mappings",
			Category:    uiCategory,
			Spec:        KnownPhoneExtensionSpec,
			Multi:       true,
		},
		runtime.Schema{
			Name:        "Roster",
			Description: "User interface configuration for the duty roster",
			Spec:        RosterUISpec,
			Category:    uiCategory,
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
