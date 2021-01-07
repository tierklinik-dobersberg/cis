package integration_test

import (
	"context"
	"flag"
	"log"
	"net/http"
	"net/http/cookiejar"
	"os"
	"os/exec"
	"strings"
	"testing"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
)

// Identities used for testing
var (
	AsAlice *http.Client
)

var client mqtt.Client

// Addional flags
var (
	buildFlag   = flag.Bool("build", true, "Build cisd")
	logFlag     = flag.String("log", "", "What to log from compose")
	keepRunning = flag.Bool("keep", false, "keep everything running after the tests")
)

func runCompose(ctx context.Context, args []string) error {
	log.Printf("running: docker-compose %s", strings.Join(args, " "))
	cmd := exec.CommandContext(ctx, "docker-compose", args...)

	cmd.Stderr = os.Stderr
	cmd.Stdout = os.Stdout

	if err := cmd.Run(); err != nil {
		return err
	}
	return nil
}

func waitReachable(ctx context.Context) error {
	for {
		resp, err := http.Get("http://localhost:3000")
		if err != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}

			time.Sleep(10 * time.Millisecond)
			continue
		}

		defer resp.Body.Close()

		return nil
	}
}

func TestMain(m *testing.M) {
	if !flag.Parsed() {
		flag.Parse()
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()

	if *buildFlag {
		if err := runCompose(ctx, []string{"build"}); err != nil {
			log.Fatal(err)
		}
	}

	start := time.Now()
	if err := runCompose(context.Background(), []string{"up", "-d"}); err != nil {
		log.Fatal(err)
	}

	if *logFlag != "" {
		if *logFlag == "all" {
			go func() {
				if err := runCompose(context.Background(), []string{"logs", "-f"}); err != nil {
					log.Println(err.Error())
				}
			}()
		} else {
			go func() {
				if err := runCompose(context.Background(), []string{"logs", "-f", *logFlag}); err != nil {
					log.Println(err.Error())
				}
			}()

		}
	}

	var code int
	defer func() {
		os.Exit(code)
	}()

	if !*keepRunning {
		defer func() {
			if err := runCompose(context.Background(), []string{"down", "-v"}); err != nil {
				log.Println(err.Error())
			}
		}()
	}

	if err := waitReachable(ctx); err != nil {
		return
	}
	log.Printf("service up and running after %s", time.Since(start))

	clientCfg := mqtt.NewClientOptions().AddBroker("tcp://localhost:1883").SetClientID("integration_test")
	client = mqtt.NewClient(clientCfg)

	if token := client.Connect(); token.Wait() && token.Error() != nil {
		log.Fatalf("failed to connect to mosquitto: %s", token.Error())
	}

	// Create a HTTP client for alice and retrieve a session cookie for it.
	jar, _ := cookiejar.New(nil)
	AsAlice = &http.Client{
		Jar: jar,
	}
	AsAlice.Post("http://localhost:3000/api/identity/v1/login", "application/json", strings.NewReader(`
	{
		"username": "alice",
		"password": "password"
	}`))

	// Actually run the tests
	code = m.Run()

	cancel()

	log.Printf("Test suites executed: %d", code)
}
