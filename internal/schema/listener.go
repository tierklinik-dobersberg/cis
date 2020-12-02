package schema

import (
	"fmt"

	"github.com/ppacher/system-conf/conf"
)

// Listener defines a listener for the API server.
type Listener struct {
	Address     string
	TLSCertFile string
	TLSKeyFile  string
}

// ListenerSpec defines the available configuration values for the
// [Listener] sections.
var ListenerSpec = []conf.OptionSpec{
	{
		Name:        "Address",
		Required:    true,
		Description: "Address to listen on in the format of <ip/hostname>:<port>.",
		Type:        conf.StringType,
	},
	{
		Name:        "CertificateFile",
		Description: "Path to the TLS certificate file (PEM format)",
		Type:        conf.StringType,
	},
	{
		Name:        "PrivateKeyFile",
		Description: "Path to the TLS private key file (PEM format)",
		Type:        conf.StringType,
	},
}

// BuildListener builds a listener from a listener section.
func BuildListener(sec conf.Section) (Listener, error) {
	var (
		l   Listener
		err error
	)

	l.Address, err = sec.GetString("Address")
	if err != nil {
		return l, fmt.Errorf("Listener.Address: %w", err)
	}

	l.TLSCertFile, err = getOptionalString(sec, "CertificateFile")
	if err != nil {
		return l, fmt.Errorf("Listener.CertificateFile: %w", err)
	}

	l.TLSKeyFile, err = getOptionalString(sec, "PrivateKeyFile")
	if err != nil {
		return l, fmt.Errorf("Listener.PrivateKeyFile: %w", err)
	}

	return l, nil
}
