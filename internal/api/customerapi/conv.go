package customerapi

import (
	"context"

	"github.com/tierklinik-dobersberg/cis/internal/database/customerdb"
	v1 "github.com/tierklinik-dobersberg/cis/pkg/models/customer/v1alpha"
)

// CustomerModel converts a database customer record to
// it's API representation.
func CustomerModel(ctx context.Context, customer *customerdb.Customer) *v1.Customer {
	return &v1.Customer{
		City:                customer.City,
		CityCode:            customer.CityCode,
		CustomerID:          customer.CustomerID,
		Firstname:           customer.Firstname,
		Group:               customer.Group,
		ID:                  customer.ID.Hex(),
		Name:                customer.Name,
		PhoneNumbers:        customer.PhoneNumbers,
		MailAddresses:       customer.MailAddresses,
		Street:              customer.Street,
		Title:               customer.Title,
		Metadata:            customer.Metadata,
		Source:              customer.Source,
		VaccinationReminder: customer.VaccinationReminder,
		CreatedAt:           customer.CreatedAt,
		ModifiedAt:          customer.ModifiedAt,
	}
}
