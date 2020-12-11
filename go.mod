module github.com/tierklinik-dobersberg/userhub

go 1.14

require (
	github.com/gin-gonic/gin v1.6.3
	github.com/go-playground/validator/v10 v10.4.1 // indirect
	github.com/golang/protobuf v1.4.3 // indirect
	github.com/json-iterator/go v1.1.10 // indirect
	github.com/modern-go/concurrent v0.0.0-20180306012644-bacd9c7ef1dd // indirect
	github.com/modern-go/reflect2 v1.0.1 // indirect
	github.com/ory/graceful v0.1.1
	github.com/pkg/errors v0.9.1 // indirect
	github.com/ppacher/system-conf v0.3.0
	github.com/tierklinik-dobersberg/logger v0.0.0-20201125171257-d519c7625406
	github.com/tierklinik-dobersberg/service v0.0.0-20201209215058-8e2301f0f22a
	github.com/ugorji/go v1.2.0 // indirect
	golang.org/x/crypto v0.0.0-20201124201722-c8d3bf9c5392
	golang.org/x/sync v0.0.0-20201207232520-09787c993a3a
	golang.org/x/sys v0.0.0-20201119102817-f84b799fce68 // indirect
	google.golang.org/protobuf v1.25.0 // indirect
	gopkg.in/yaml.v2 v2.3.0 // indirect
)

replace github.com/tierklinik-dobersberg/service => ../service

replace github.com/ppacher/system-conf => ../system-conf
