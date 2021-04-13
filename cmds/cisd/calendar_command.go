package main

import (
	"bytes"
	"context"
	"fmt"
	"log"
	"sort"
	"time"

	"github.com/spf13/cobra"
	"github.com/tierklinik-dobersberg/cis/internal/calendar"
)

var (
	calendarCredFile  string
	calendarTokenFile string
)

func calendarService() calendar.Service {
	cfg := calendar.Config{
		CredentialsFile: calendarCredFile,
		TokenFile:       calendarTokenFile,
	}

	svc, err := calendar.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	return svc
}

func getCalendarCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "calendar",
		Short: "Interact with google calendar",
	}
	f := cmd.PersistentFlags()
	{
		f.StringVarP(&calendarCredFile, "creds", "c", "", "Path to the credentials file")
		f.StringVarP(&calendarTokenFile, "token", "t", "", "Path to token file")
	}
	cmd.AddCommand(
		getCalendarAuthCommand(),
		getCalendarListCommand(),
		getEventsCommand(),
	)

	return cmd
}

func getCalendarAuthCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use: "authenticate",
		Run: func(cmd *cobra.Command, args []string) {
			if err := calendar.Authenticate(calendar.Config{
				CredentialsFile: calendarCredFile,
				TokenFile:       calendarTokenFile,
			}); err != nil {
				log.Fatal(err)
			}
		},
	}
	return cmd
}

func getCalendarListCommand() *cobra.Command {
	return &cobra.Command{
		Use: "list-calendars",
		Run: func(cmd *cobra.Command, args []string) {
			svc := calendarService()
			ctx := context.Background()
			list, err := svc.ListCalendars(ctx)
			if err != nil {
				log.Fatal(err)
			}

			buf := new(bytes.Buffer)
			for _, item := range list {
				fmt.Fprintf(buf, "- _%s_ **%s**  	\n", item.ID, item.Name)
			}
			fmt.Println(Render(buf.String()))
		},
	}
}

func getEventsCommand() *cobra.Command {
	var (
		forDay string
	)

	cmd := &cobra.Command{
		Use: "list-events",
		Run: func(cmd *cobra.Command, args []string) {
			svc := calendarService()
			opts := new(calendar.EventSearchOptions)

			if len(args) == 0 {
				list, err := svc.ListCalendars(context.Background())
				if err != nil {
					log.Fatalf("failed to get calendars: %s", err)
				}
				for _, cal := range list {
					args = append(args, cal.ID)
				}
			}

			isToday := false
			if forDay != "" {
				t, err := time.Parse("2006-01-02", forDay)
				if err != nil {
					log.Fatalf("--for-day: %s", err.Error())
				}
				isToday = forDay == time.Now().Format("2006-01-02")
				opts.ForDay(t)
			}

			var allEvents []calendar.Event
			for _, calId := range args {
				events, err := svc.ListEvents(
					context.Background(),
					calId,
					opts,
				)
				if err != nil {
					log.Fatal(err)
				}
				allEvents = append(allEvents, events...)
			}

			sort.Sort(calendar.ByStartTime(allEvents))

			buf := new(bytes.Buffer)
			for _, event := range allEvents {
				bold := "**"
				if isToday && event.StartTime.Before(time.Now()) {
					bold = ""
				}

				fmt.Fprintf(buf, "- _%s_ %s%s%s\n", event.StartTime.Format("15:04"), bold, event.Summary, bold)
			}

			fmt.Println(Render(buf.String()))
		},
	}
	f := cmd.Flags()
	{
		f.StringVar(&forDay, "for-day", "", "Date to load events for. Format YYYY-MM-DD")
	}

	return cmd
}
