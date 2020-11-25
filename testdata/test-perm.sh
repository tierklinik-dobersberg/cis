#!/usr/bin/env bash

curl -D - -H "Host: example.com" --user test:password -H "X-Original-URL: https://secure.example.com/resource/foobar" -b /tmp/cookies http://localhost:3000/api/verify
