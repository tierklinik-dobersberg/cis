package patientdb

import (
	"crypto/sha1"
	"encoding/hex"

	"github.com/tierklinik-dobersberg/cis/pkg/models/patient/v1alpha"
)

// RecordHash returns a hash that represents the record and may be
// used for change detection.
func RecordHash(r v1alpha.PatientRecord) string {
	h := sha1.New()
	w := func(s string) {
		_, _ = h.Write([]byte(s))
	}
	w(r.CustomerSource)
	w(r.CustomerID)
	w(r.Size)
	w(r.Species)
	w(r.Breed)
	w(r.Gender)
	w(r.Name)
	w(r.Birthday)
	w(r.SpecialDetail)
	w(r.AnimalID)
	w(r.Color)
	w(r.ChipNumber)
	for _, n := range r.Notes {
		w(n)
	}
	return hex.EncodeToString(h.Sum(nil))
}
