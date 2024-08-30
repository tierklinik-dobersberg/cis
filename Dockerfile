
# Build the frontend
FROM node:18 as builder
ARG CONFIGURATION="production"
ARG GITHUB_TOKEN

WORKDIR /app/ui

COPY ui/.npmrc ui/package.json ui/pnpm-lock.yaml ./
RUN --mount=type=secret,id=github_token \
  export GITHUB_TOKEN="$(cat /run/secrets/github_token)" && npx pnpm install && npx pnpm install pnpm

RUN npx browserslist@latest --update-db

COPY ./ui .
RUN echo "Building frontend in configuration $CONFIGURATION"
RUN npx ng build --configuration $CONFIGURATION && rm -r .angular/cache node_modules

# Build cisd
FROM golang:1.20 as build

RUN update-ca-certificates

WORKDIR /go/src/app

COPY go.mod .

ENV GO111MODULE=on
RUN go mod download
RUN go mod verify

COPY . .

COPY --from=builder /app/cmds/cisd/ui /go/src/app/cmds/cisd/ui

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /go/bin/cisd ./cmds/cisd

FROM gcr.io/distroless/static

COPY --from=build /go/bin/cisd /go/bin/cisd
EXPOSE 3000
ENTRYPOINT ["/go/bin/cisd"]
