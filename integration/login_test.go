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
	res, err := suite.cli.Post("http://localhost:3000/api/identity/v1/login", "application/json; charset=utf-8", strings.NewReader(`
	{
		"username": "alice",
		"password": "password"
	}`))

	if err != nil {
		suite.FailNow(err.Error())
	}

	suite.Equal(http.StatusOK, res.StatusCode)
	suite.Len(res.Cookies(), 1)
}

func (suite *LoginTestSuite) Test_3_AliceCookieValid() {
	res, err := suite.cli.Post("http://localhost:3000/api/identity/v1/login", "", nil)
	if err != nil {
		suite.FailNow(err.Error())
	}

	suite.Equal(http.StatusOK, res.StatusCode)
	suite.Len(res.Cookies(), 0)
}

func TestLogin(t *testing.T) {
	suite.Run(t, new(LoginTestSuite))
}
