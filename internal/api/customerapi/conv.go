package customerapi

import (
	"context"

	"github.com/tierklinik-dobersberg/cis/internal/database/customerdb"
	v1 "github.com/tierklinik-dobersberg/cis/pkg/models/customer/v1alpha"
)

// CustomerModel converts a database customer record to
// it's API representation.
func CustomerModel(ctx context.Context, cu *customerdb.Customer) *v1.Customer {
	return &v1.Customer{
		City:       cu.City,
		CityCode:   cu.CityCode,
		CustomerID: cu.CustomerID,
		Firstname:  cu.Firstname,
		Group:      cu.Group,
		ID:         cu.ID.Hex(),
		Name:       cu.Name,
		Phone:      cu.Phone,
		Street:     cu.Street,
		Title:      cu.Title,
	}
}
