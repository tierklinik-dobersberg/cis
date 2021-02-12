package permission

import "github.com/tierklinik-dobersberg/logger"

// Request describes a permission request received on /api/verify.
type Request struct {
	// User is the user that tries to perfom the operation.
	User string
	// Resource is the path of the resourc eon the target host.
	Resource string
	// Action is the name of the action to be performed.
	Action string
}

// AsFields returns a logger.Fields map that represents the request.
func (req *Request) AsFields() logger.Fields {
	return logger.Fields{
		"request:user":     req.User,
		"request:resource": req.Resource,
		"request:action":   req.Action,
	}
}
