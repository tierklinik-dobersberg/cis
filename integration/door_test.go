package integration_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"gotest.tools/assert"
)

func TestEntryDoorState(t *testing.T) {
	cases := []struct {
		Date   string
		Time   string
		Locked bool
	}{
		{
			Date:   "2020/12/21",
			Time:   "7:15",
			Locked: true,
		},
		{
			Date:   "2020/12/21",
			Time:   "11:15",
			Locked: false,
		},
		{
			Date:   "2020/12/21",
			Time:   "12:16",
			Locked: true,
		},
		{
			Date:   "2020/12/21",
			Time:   "14:00",
			Locked: false,
		},
		{
			Date:   "2020/12/21",
			Time:   "16:45",
			Locked: false,
		},
		{
			Date:   "2020/12/21",
			Time:   "18:25",
			Locked: true,
		},
		{
			Date:   "2020/12/24",
			Time:   "08:30",
			Locked: true,
		},
		{
			Date:   "2020/12/24",
			Time:   "09:10",
			Locked: false,
		},
		{
			Date:   "2020/12/24",
			Time:   "12:00",
			Locked: false,
		},
		{
			Date:   "2020/12/24",
			Time:   "14:30",
			Locked: true,
		},
	}

	for idx, c := range cases {
		url := "http://localhost:3000/api/door/v1/test/" + c.Date + "/" + strings.ReplaceAll(c.Time, ":", "/")
		msg := fmt.Sprintf("#%d date: %q time:%q expected: %v", idx, c.Date, c.Time, c.Locked)

		resp, err := http.Get(url)
		require.NoError(t, err, msg)

		var result struct {
			State string    `json:"desiredState"`
			Until time.Time `json:"until"`
		}
		defer resp.Body.Close()

		err = json.NewDecoder(resp.Body).Decode(&result)
		require.NoError(t, err, msg)

		if c.Locked {
			assert.Equal(t, "locked", result.State, msg+" until: "+result.Until.String())
		} else {
			assert.Equal(t, "unlocked", result.State, msg+" until: "+result.Until.String())
		}
	}
}
