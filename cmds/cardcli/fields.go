package main

import "github.com/emersion/go-vcard"

var defaultFields = []string{"fn", "phone", "email"}

var fieldToName = map[string]string{
	vcard.FieldSource:             "source",
	vcard.FieldKind:               "kind",
	vcard.FieldXML:                "xml",
	vcard.FieldFormattedName:      "fn",
	vcard.FieldName:               "name",
	vcard.FieldNickname:           "nickname",
	vcard.FieldPhoto:              "photo",
	vcard.FieldBirthday:           "bday",
	vcard.FieldAnniversary:        "anniversary",
	vcard.FieldGender:             "gender",
	vcard.FieldAddress:            "address",
	vcard.FieldTelephone:          "phone",
	vcard.FieldEmail:              "email",
	vcard.FieldIMPP:               "impp",
	vcard.FieldLanguage:           "lang",
	vcard.FieldTimezone:           "timezone",
	vcard.FieldGeolocation:        "geo",
	vcard.FieldTitle:              "title",
	vcard.FieldRole:               "role",
	vcard.FieldLogo:               "logo",
	vcard.FieldOrganization:       "org",
	vcard.FieldMember:             "member",
	vcard.FieldRelated:            "related",
	vcard.FieldCategories:         "categories",
	vcard.FieldNote:               "note",
	vcard.FieldProductID:          "prodid",
	vcard.FieldRevision:           "rev",
	vcard.FieldSound:              "sound",
	vcard.FieldUID:                "uid",
	vcard.FieldClientPIDMap:       "clientpidmap",
	vcard.FieldURL:                "url",
	vcard.FieldVersion:            "version",
	vcard.FieldKey:                "key",
	vcard.FieldFreeOrBusyURL:      "fburl",
	vcard.FieldCalendarAddressURI: "calendaraddruri",
	vcard.FieldCalendarURI:        "calendaruri",
}

var nameToField = map[string]string{}

func init() {
	for k, v := range fieldToName {
		nameToField[v] = k
	}
}
