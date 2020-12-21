package integration_test

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"testing"
	"time"
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
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if err := runCompose(ctx, []string{"build"}); err != nil {
		log.Fatal(err)
	}

	start := time.Now()
	if err := runCompose(ctx, []string{"up", "-d"}); err != nil {
		log.Fatal(err)
	}

	go func() {
		if err := runCompose(context.Background(), []string{"logs", "-f", "cisd"}); err != nil {
			log.Println(err.Error())
		}
	}()

	var code int
	defer func() {
		os.Exit(code)
	}()
	defer func() {
		if err := runCompose(context.Background(), []string{"down"}); err != nil {
			log.Println(err.Error())
		}
	}()

	if err := waitReachable(ctx); err != nil {
		return
	}
	log.Printf("service up and running after %s", time.Since(start))

	code = m.Run()
	cancel()

	log.Printf("Test suites executed: %d", code)
}
