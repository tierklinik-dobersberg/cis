package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"sync"
	"time"
)

func runService(ctx context.Context) (*exec.Cmd, error) {
	cmd := exec.CommandContext(ctx, "go", "run", "cmd/cis/main.go")

	cmd.Env = append(os.Environ(), []string{
		fmt.Sprintf("CONFIGURATION_DIRECTORY=%s", "./testdata/config"),
	}...)

	cmd.Stderr = os.Stderr
	cmd.Stdout = os.Stdout

	if err := cmd.Start(); err != nil {
		return nil, err
	}
	return cmd, nil
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

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	cmd, err := runService(ctx)
	if err != nil {
		log.Fatal(err)
	}

	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		defer cancel()
		if err := cmd.Wait(); err != nil {
			return
		}
	}()

	if err := waitReachable(ctx); err != nil {
		return
	}

	wg.Wait()
}
