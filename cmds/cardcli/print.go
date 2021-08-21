package main

import (
	"log"
	"os"
	"strings"

	"github.com/emersion/go-vcard"
	"github.com/emersion/go-webdav/carddav"
	"github.com/olekukonko/tablewriter"
)

func printObjects(objs []carddav.AddressObject) {
	if cfg.format == "table" {
		tw := tablewriter.NewWriter(os.Stdout)
		tw.SetAlignment(tablewriter.ALIGN_LEFT)
		tw.SetHeader(cfg.columns)
		tw.SetBorders(tablewriter.Border{Left: true, Top: false, Right: true, Bottom: false})
		tw.SetCenterSeparator("|")

		for _, obj := range objs {
			cols := []string{}
			for _, col := range cfg.columns {
				val := obj.Card.Value(nameToField[col])
				val = strings.TrimSpace(val)
				cols = append(cols, val)
			}
			tw.Append(cols)
		}

		tw.Render()
		return
	}

	if cfg.format == "vcard" {
		encoder := vcard.NewEncoder(os.Stdout)

		for _, obj := range objs {
			if err := encoder.Encode(obj.Card); err != nil {
				log.Printf("failed to encode %s: %s", obj.Path, err)
			}
		}
	}
}
