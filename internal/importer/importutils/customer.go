package importutils

import "github.com/tierklinik-dobersberg/cis/internal/database/customerdb"

// CopyCustomerAttributes copies CIS-only attributes from old to upd.
func CopyCustomerAttributes(old *customerdb.Customer, upd *customerdb.Customer) {
	upd.ID = old.ID
	upd.LinkedTo = old.LinkedTo
}
