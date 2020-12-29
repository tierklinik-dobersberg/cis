package integration_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
	"golang.org/x/net/context"
)

type DoorTestSuite struct {
	suite.Suite
}

func (suite *DoorTestSuite) Test_Dates() {
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
		msg := fmt.Sprintf("#%d date: %q time:%q expected: %v", idx, c.Date, c.Time, c.Locked)
		url := "http://localhost:3000/api/door/v1/test/" + c.Date + "/" + strings.ReplaceAll(c.Time, ":", "/")

		resp, err := http.Get(url)
		require.NoError(suite.T(), err, msg)

		var result struct {
			State string    `json:"desiredState"`
			Until time.Time `json:"until"`
		}
		defer resp.Body.Close()

		err = json.NewDecoder(resp.Body).Decode(&result)
		require.NoError(suite.T(), err, msg)

		if c.Locked {
			suite.Equal("locked", result.State, msg+" until: "+result.Until.String())
		} else {
			suite.Equal("unlocked", result.State, msg+" until: "+result.Until.String())
		}
	}
}

func (suite *DoorTestSuite) Test_Reset() {
	topic := "cliny/rpc/service/door/#"

	ch := make(chan string, 3)

	handler := func(cli mqtt.Client, msg mqtt.Message) {
		ch <- msg.Topic()
		var result struct {
			ReplyTo string `json:"replyTo"`
		}

		if err := json.Unmarshal(msg.Payload(), &result); err != nil {
			suite.Fail("failed to decode MQTT payload: %s", err.Error())
			return
		}

		// cisd should wait for the response so make sure we provide one
		cli.Publish(result.ReplyTo, 0, false, "").Wait()
	}

	if token := client.Subscribe(topic, 0, handler); token.Wait() && token.Error() != nil {
		suite.FailNow("failed to subscribe: %s", token.Error())
		return
	}

	resp, err := http.Post("http://localhost:3000/api/door/v1/reset", "", nil)
	require.NoError(suite.T(), err)
	suite.Equal(http.StatusOK, resp.StatusCode)

	receive := func() string {
		ctx, cancel := context.WithTimeout(context.Background(), time.Second*10)
		defer cancel()

		select {
		case msg := <-ch:
			return strings.TrimPrefix(msg, "cliny/rpc/service/door/")
		case <-ctx.Done():
			return ""
		}
	}

	suite.Equal([]string{"unlock", "lock", "unlock"}, []string{
		receive(), receive(), receive(),
	})
}

func TestDoor(t *testing.T) {
	suite.Run(t, new(DoorTestSuite))
}
