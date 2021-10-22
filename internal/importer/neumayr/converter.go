package neumayr

import (
	"archive/zip"
	"context"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"

	"github.com/nyaruka/phonenumbers"
	"github.com/tierklinik-dobersberg/cis/internal/database/customerdb"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
)

var log = pkglog.New("neumayr")

// Converter converts contact data from Neumayr installations.
type Converter struct {
	country string
}

// NewConverter returns a new converter for Neumayr contacts.
func NewConverter(country string) (*Converter, error) {
	return &Converter{
		country: country,
	}, nil
}

func (conv *Converter) Convert(ctx context.Context, mdb *os.File) ([]customerdb.Customer, error) {
	log := log.From(ctx)
	log.Infof("converting MDB to CSV archive using RebaseData")
	zipFile, err := ConvertMDB(mdb)
	if err != nil {
		return nil, err
	}

	log.Infof("Parsing records ...")
	size, err := zipFile.Seek(0, 2)
	if err != nil {
		return nil, fmt.Errorf("failed to seek to end: %w", err)
	}
	if _, err := zipFile.Seek(0, 0); err != nil {
		return nil, fmt.Errorf("failed to seek to beginning of file: %w", err)
	}

	zipReader, err := zip.NewReader(zipFile, size)
	if err != nil {
		return nil, fmt.Errorf("failed to prepare zip-reader: %w", err)
	}

	var reader io.ReadCloser
	for _, f := range zipReader.File {
		if f.Name == "Namensliste.csv" {
			reader, err = f.Open()
			if err != nil {
				return nil, fmt.Errorf("failed to open ZIP file reader: %w", err)
			}
			defer reader.Close()
		}
	}

	if reader == nil {
		return nil, fmt.Errorf("failed to find file Namensliste.csv in ZIP archive")
	}

	csvReader := csv.NewReader(reader)

	wantedHeaders := map[string]int{
		"ID":             -1,
		"Namen":          -1,
		"Adresse":        -1,
		"Telefon":        -1,
		"EMail":          -1,
		"Betriebsnummer": -1,
		"Kundennummer":   -1,
	}

	isHeader := true

	var result []customerdb.Customer

	for {
		record, err := csvReader.Read()
		if errors.Is(err, io.EOF) {
			break
		}

		if err != nil {
			log.Errorf("failed to read record from CSV file: %s", err)
			if !errors.Is(err, csv.ErrFieldCount) {
				continue
			}
		}

		// find the correct column indices for all headers
		// we are interested in.
		if isHeader {
			for idx, header := range record {
				if _, ok := wantedHeaders[header]; ok {
					wantedHeaders[header] = idx
				}
			}
			for header, index := range wantedHeaders {
				if index == -1 {
					return nil, fmt.Errorf("failed to determine column index for %q", header)
				}
			}
			isHeader = false
			continue
		}

		get := func(header string) string {
			return record[wantedHeaders[header]]
		}

		// ID
		id := get("ID")

		// Name
		nameParts := strings.SplitN(get("Namen"), " ", 2)
		lastname := nameParts[0]
		firstname := ""
		if len(nameParts) == 2 {
			firstname = nameParts[1]
		}

		// Address
		addressParts := strings.SplitN(get("Adresse"), ",", 2)
		var street string
		if len(addressParts) == 2 {
			street = addressParts[1]
		}
		cityParts := strings.SplitN(addressParts[0], " ", 2)
		cityCode, err := strconv.ParseInt(cityParts[0], 10, 0)
		if err != nil {
			log.Errorf("failed to parse city code from %q: %s", addressParts[0])
		}
		city := addressParts[0]
		if len(cityParts) == 2 {
			city = cityParts[1]
		}

		rawPhone := get("Telefon")
		var phone *phonenumbers.PhoneNumber
		if len(rawPhone) > 3 {
			phone, err = phonenumbers.Parse(rawPhone, conv.country)
			if err != nil {
				log.Errorf("failed to parse phone number from %q: %s", rawPhone, err)
			}
		}

		mail := get("EMail")
		businessNumber := get("Betriebsnummer")
		customerNumber := get("Kundennummer")

		customer := customerdb.Customer{
			CustomerID: id,
			Source:     "neumayr",
			City:       city,
			CityCode:   int(cityCode),
			Name:       lastname,
			Firstname:  firstname,
			Street:     street,
			Metadata:   map[string]interface{}{},
		}

		if businessNumber != "" {
			customer.Metadata["businessNumber"] = businessNumber
		}

		if customerNumber != "" {
			customer.Metadata["customerNumber"] = customerNumber
		}

		if mail != "" {
			customer.MailAddresses = append(customer.MailAddresses, mail)
		}

		if phone != nil {
			customer.PhoneNumbers = []string{
				phonenumbers.Format(phone, phonenumbers.NATIONAL),
				phonenumbers.Format(phone, phonenumbers.INTERNATIONAL),
			}
		}

		result = append(result, customer)
	}

	return result, nil
}
