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
	commands chan string
}

func (suite *DoorTestSuite) clearCommands() {
	for {
		select {
		case <-suite.commands:
			continue
		case <-time.After(time.Second):
			return
		}
	}
}

func (suite *DoorTestSuite) SetupSuite() {
	suite.commands = make(chan string, 10)
	topic := "cliny/rpc/service/door/#"

	handler := func(cli mqtt.Client, msg mqtt.Message) {
		suite.T().Log("received message on " + msg.Topic())
		suite.commands <- msg.Topic()
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

	suite.receiveCommand()
	suite.clearCommands()
}

func (suite *DoorTestSuite) Test_0_Dates() {
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
		state, until := suite.getState(c.Date, c.Time)

		if c.Locked {
			suite.Equal("locked", state, msg+" until: "+until.String())
		} else {
			suite.Equal("unlocked", state, msg+" until: "+until.String())
		}
	}
}
func (suite *DoorTestSuite) Test_1_Reset() {
	defer suite.clearCommands()
	resp, err := http.Post("http://localhost:3000/api/door/v1/reset", "", nil)

	require.NoError(suite.T(), err)
	suite.Equal(http.StatusOK, resp.StatusCode)

	result := []string{
		suite.receiveCommand(),
		suite.receiveCommand(),
		suite.receiveCommand(),
	}

	suite.T().Logf("received results: %+v", result)

	// a reset should trigger the following sequence of commands ...
	suite.Equal([]string{"unlock", "lock", "unlock"}, result)

}

func (suite *DoorTestSuite) Test_2_Overwrite() {
	defer suite.clearCommands()

	now := time.Now()
	date := fmt.Sprintf("%04d/%02d/%02d", now.Year(), now.Month(), now.Day())
	t := fmt.Sprintf("%02d:%02d", now.Hour(), now.Minute())
	current, until := suite.getState(date, t)

	var next string
	var expectedState string
	switch current {
	case "locked":
		next = "unlock"
		expectedState = "unlocked"
	case "unlocked":
		next = "lock"
		expectedState = "locked"
	default:
		suite.FailNow("unexpected door state")
	}

	d := until.Sub(time.Now()) + time.Hour

	blob, _ := json.Marshal(map[string]interface{}{
		"state":    next,
		"duration": d.String(),
	})

	resp, err := http.Post("http://localhost:3000/api/door/v1/overwrite", "application/json", strings.NewReader(string(blob)))
	suite.Equal(next, suite.receiveCommand())

	require.NoError(suite.T(), err)
	suite.Equal(http.StatusOK, resp.StatusCode, resp.Status)

	newState, newUntil := suite.getState(date, t)
	suite.T().Logf("expected: %s, actual: %s", time.Now().Add(d), newUntil)
	suite.Equal(time.Now().Add(d).Unix(), newUntil.Unix())
	suite.Equal(expectedState, newState)
}

func (suite *DoorTestSuite) receiveCommand() string {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second*10)
	defer cancel()

	select {
	case msg := <-suite.commands:
		return strings.TrimPrefix(msg, "cliny/rpc/service/door/")
	case <-ctx.Done():
		return ""
	}
}

func (suite *DoorTestSuite) getState(date string, t string) (string, time.Time) {
	suite.T().Helper()

	msg := fmt.Sprintf("date: %q time:%q ", date, t)
	url := "http://localhost:3000/api/door/v1/test/" + date + "/" + strings.ReplaceAll(t, ":", "/")

	resp, err := http.Get(url)
	require.NoError(suite.T(), err, msg)

	var result struct {
		State string    `json:"desiredState"`
		Until time.Time `json:"until"`
	}
	defer resp.Body.Close()

	err = json.NewDecoder(resp.Body).Decode(&result)
	require.NoError(suite.T(), err, msg)

	return result.State, result.Until
}

func TestDoor(t *testing.T) {
	suite.Run(t, new(DoorTestSuite))
}
