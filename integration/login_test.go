package integration_test

import (
	"net/http"
	"net/http/cookiejar"
	"strings"
	"testing"

	"github.com/stretchr/testify/suite"
)

type LoginTestSuite struct {
	suite.Suite
	cli *http.Client
	jar http.CookieJar
}

func (suite *LoginTestSuite) SetupSuite() {
	suite.jar, _ = cookiejar.New(nil)
	suite.cli = &http.Client{Jar: suite.jar}
}

func (suite *LoginTestSuite) Test_1_LoginBobFails() {
	res, err := http.Post("http://localhost:3000/api/identity/v1/login", "application/json; charset=utf-8", strings.NewReader(`
	{
		"username": "bob",
		"password": ""
	}`))

	if err != nil {
		suite.FailNow(err.Error())
		return
	}

	suite.Equal(http.StatusUnauthorized, res.StatusCode)
}

func (suite *LoginTestSuite) Test_2_LoginAliceSuccess() {
	req, err := http.NewRequest("POST", "http://localhost:3000/api/identity/v1/login", strings.NewReader(`
	{
		"username": "alice",
		"password": "password"
	}`))
	if !suite.NoError(err) {
		return
	}

	req.Header.Set("Content-Type", "application/json; chartset=utf8")

	// This should trigger autologin of the guest user and tests TrustedProxies= and
	// autologin using RequestFromCIDR=. It also ensures that the login endpoint
	// clears the autologin session and only returns a cookie for alice.
	// See the Autologin test below as well.
	req.Header.Set("Forwarded", "by=test; for=10.0.0.100:3000; host=example.com")

	res, err := suite.cli.Do(req)

	if err != nil {
		suite.FailNow(err.Error())
	}

	suite.Equal(http.StatusOK, res.StatusCode)
	suite.Len(res.Cookies(), 2)

	hasSession := false
	hasRefresh := false

	// TODO(ppacher): better validate the cookies
	for _, r := range res.Cookies() {
		if r.Name == "cis-session" {
			hasSession = true
		}

		if r.Name == "cis-refresh" {
			hasRefresh = true
		}
	}

	suite.True(hasSession)
	suite.True(hasRefresh)
}

func (suite *LoginTestSuite) Test_3_AliceCookieValid() {
	res, err := suite.cli.Post("http://localhost:3000/api/identity/v1/login", "", nil)
	if err != nil {
		suite.FailNow(err.Error())
	}

	suite.Equal(http.StatusNoContent, res.StatusCode)
	suite.Len(res.Cookies(), 0)
}

func (suite *LoginTestSuite) Test_4_Autologin() {
	req, err := http.NewRequest("GET", "http://localhost:3000/api/identity/v1/profile", nil)
	if !suite.NoError(err) {
		return
	}

	req.Header.Set("Forwarded", "by=test; for=10.0.0.100:3000, for=10.8.0.1:2000; host=example.com")
	res, err := http.DefaultClient.Do(req)

	suite.NoError(err)
	suite.Equal(http.StatusOK, res.StatusCode)

	// We expect to receive a session and refresh cookie automatically
	// TODO(ppacher): test CreateSession=no as well.
	suite.Len(res.Cookies(), 2)
}

func TestLogin(t *testing.T) {
	suite.Run(t, new(LoginTestSuite))
}
