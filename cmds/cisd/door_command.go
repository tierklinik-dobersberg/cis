package main

import (
	"context"

	"github.com/spf13/cobra"
	"github.com/tierklinik-dobersberg/logger"
)

func getDoorCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "door",
		Short: "Control the entry door",
	}

	cmd.AddCommand(
		getDoorLockCommand(),
		getDoorUnlockCommand(),
		getDoorOpenCommand(),
	)

	return cmd
}

func getDoorLockCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "lock",
		Short: "Lock the door",
		Run: func(_ *cobra.Command, _ []string) {
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()

			app, _, ctx := getApp(ctx)

			if err := app.Door.Lock(ctx); err != nil {
				logger.Fatalf(ctx, err.Error())
			}
		},
	}
}

func getDoorUnlockCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "unlock",
		Short: "Unlock the door",
		Run: func(_ *cobra.Command, _ []string) {
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()

			app, _, ctx := getApp(ctx)

			if err := app.Door.Unlock(ctx); err != nil {
				logger.Fatalf(ctx, err.Error())
			}
		},
	}
}

func getDoorOpenCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "open",
		Short: "Open the door",
		Run: func(_ *cobra.Command, _ []string) {
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()

			app, _, ctx := getApp(ctx)

			if err := app.Door.Open(ctx); err != nil {
				logger.Fatalf(ctx, err.Error())
			}
		},
	}
}
