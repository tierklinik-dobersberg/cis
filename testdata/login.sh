#!/usr/bin/env bash

curl -XPOST -D - -H "Host: example.com" -c /tmp/cookies --user alice:password http://localhost:3000/api/identity/v1/login
