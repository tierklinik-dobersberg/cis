package wiki

import "github.com/tierklinik-dobersberg/cis/runtime/event"

// Event types emitted by the wiki package.
var (
	EventDocumentCreated = event.MustRegisterType(event.Type{
		ID:          "vet.dobersberg.cis/wiki/document/created",
		Description: "A new wiki document has been created",
	})

	EventDocumentUpdated = event.MustRegisterType(event.Type{
		ID:          "vet.dobersberg.cis/wiki/document/updated",
		Description: "A wiki document has been updated",
	})

	EventDocumentDeleted = event.MustRegisterType(event.Type{
		ID:          "vet.dobersberg.cis/wiki/document/deleted",
		Description: "A wiki document has been deleted",
	})

	EventCollectionCreated = event.MustRegisterType(event.Type{
		ID:          "vet.dobersberg.cis/wiki/collection/created",
		Description: "A wiki document collection has been created",
	})

	EventCollectionUpdated = event.MustRegisterType(event.Type{
		ID:          "vet.dobersberg.cis/wiki/collection/updated",
		Description: "A wiki document collection has been updated",
	})

	EventCollectionDeleted = event.MustRegisterType(event.Type{
		ID:          "vet.dobersberg.cis/wiki/collection/deleted",
		Description: "A wiki document collection has been deleted",
	})
)
