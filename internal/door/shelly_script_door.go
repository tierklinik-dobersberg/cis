package door

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

type ShellyScriptDoor struct {
	url string
}

func (door *ShellyScriptDoor) Lock(ctx context.Context) error {
	return door.doRequest(ctx, "lock")
}

func (door *ShellyScriptDoor) Unlock(ctx context.Context) error {
	return door.doRequest(ctx, "unlock")
}

func (door *ShellyScriptDoor) Open(ctx context.Context) error {
	return door.doRequest(ctx, "open")
}

func (door *ShellyScriptDoor) doRequest(ctx context.Context, action string) error {
	blob, _ := json.Marshal(map[string]any{
		"action": action,
	})

	req, err := http.NewRequestWithContext(ctx, "POST", door.url, bytes.NewReader(blob))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to perform request: %w", err)
	}

	if res.StatusCode < 200 || res.StatusCode > 299 {
		return fmt.Errorf("unexpected status code: %s", res.Status)
	}

	return nil
}

func (*ShellyScriptDoor) Release() {}

var _ Interfacer = (*ShellyScriptDoor)(nil)
