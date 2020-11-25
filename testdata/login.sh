#!/usr/bin/env bash

curl -D - -H "Host: example.com" -c /tmp/cookies --user test:password http://localhost:3000/api/verify