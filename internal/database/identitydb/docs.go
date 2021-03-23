package identitydb

import (
	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/autodoc"
	"github.com/tierklinik-dobersberg/cis/internal/httpcond"
	"github.com/tierklinik-dobersberg/cis/internal/schema"
)

func init() {
	autodoc.MustRegister(autodoc.File{
		Name:           ".role",
		Multiple:       true,
		Description:    "Describes a user role and associated permissions",
		DropinsAllowed: true,
		Sections: conf.FileSpec{
			"Role":       schema.RoleSpec,
			"Permission": schema.PermissionSpec,
			// FIXME(ppacher): this is a hard assumption here. if Database
			// gets created with a different registry we report wrong configuration
			// stanzas. Or, the section might be completely invalid at all.
			"AutoAssign": httpcond.DefaultRegistry,
		},
		Example: `
		[Role]
		Name=default-role
		Description=Role that all users have

		[Permission]
		Resource=.*
		Effect=Allow
		Action=roster:read
		Action=roster:read:overwrite
		Action=door:(get|set)
		`,
		ExampleDescription: "Allow roster and door access for all users that have the default-role.",
		Template: `
		[Role]
		Name=
		Description=
		
		[Permission]
		Resource=
		Effect=Allow
		Action=
		`,
	})

	autodoc.MustRegister(autodoc.File{
		Name:           ".user",
		Multiple:       true,
		Description:    "A user identity and associated settings",
		DropinsAllowed: true,
		Sections: conf.FileSpec{
			"User":       schema.UserSpec,
			"Permission": schema.PermissionSpec,
			// FIXME(ppacher): see comment above.
			"AutoLogin": newAutologinRegistry(httpcond.DefaultRegistry, conf.SectionSpec{
				{
					Name:        "CreateSession",
					Type:        conf.BoolType,
					Description: "Whether or not a new session should be created or if only this request should be authorized",
					Default:     "no",
				},
			}),
		},
		Example: `
		[User]
		Name=alice
		FullName=Alice Musterfrau
		PasswordAlgo=plain
		PasswordHash=password
		Mail=alice@example.at
		Mail=alice@example.com
		PhoneNumber=+4312345678
		PhoneNumber=+2812345
		Roles=default-role
		Color=#1b7550b9

		# The following properties are "customer" user-properties
		# and must follow there definition in cis.conf
		GoogleCalendarID=primary
		PhoneExtension=10

		[Permission]
		Resource=.*
		Action=.*
		Effect=allow	
		`,
		ExampleDescription: "A user defintion must custom user properties.",
		Template: `
		[User]
		Name=
		FullName=
		# PasswordAlgo should start with plain and switches to bcrypt
		# once the user changes the password
		PasswordAlgo=plain
		Passowrd=
		Mail=
		PhoneNumber=
		Roles=default-role
		Color=

		[Permission]
		Resource=
		Action=
		Effect=allow	
		`,
	})
}
