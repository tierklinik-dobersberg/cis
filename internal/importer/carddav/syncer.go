package carddav

import (
	"context"

	"github.com/emersion/go-webdav/carddav"
	"github.com/tierklinik-dobersberg/cis/pkg/cache"
)

// Syncer syns against a CardDAV server.
type Syncer struct {
	Cache       cache.Cache
	CachePrefix string
}

func (s *Syncer) Sync(ctx context.Context) (chan carddav.AddressObject, error) {
	ch := make(chan carddav.AddressObject)

	go func() {
		defer close(ch)
		// TODO(ppacher): sync ...
	}()

	return ch, nil
}
