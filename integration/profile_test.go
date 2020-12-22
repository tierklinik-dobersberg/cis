package integration_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/suite"
	"github.com/tierklinik-dobersberg/cis/pkg/models/identity/v1alpha"
)

type ProfileTestSuite struct {
	suite.Suite
}

func (suite *ProfileTestSuite) Test_AliceProfileSuccess() {
	res, err := AsAlice.Get("http://localhost:3000/api/identity/v1/profile")
	if err != nil {
		suite.FailNow(err.Error())
	}

	suite.Equal(http.StatusOK, res.StatusCode)

	var p v1alpha.User
	err = json.NewDecoder(res.Body).Decode(&p)

	suite.NoError(err)
	suite.Equal(v1alpha.User{
		Fullname:    "Alice Musterfrau",
		GroupNames:  []string{"default-group"},
		Mail:        []string{"alice@example.at", "alice@example.com"},
		Name:        "alice",
		PhoneNumber: []string{"+4312345678", "+2812345"},
		Properties: map[string]interface{}{
			"GoogleCalendarID": "primary",
		},
	}, p)
}

func TestProfileSuite(t *testing.T) {
	suite.Run(t, new(ProfileTestSuite))
}
