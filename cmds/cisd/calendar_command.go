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
	cfg := calendar.GoogleCalendarConfig{
		Enabled:         true,
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
		getCreateEventCommand(),
	)

	return cmd
}

func getCalendarAuthCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use: "authenticate",
		Run: func(cmd *cobra.Command, args []string) {
			if err := calendar.Authenticate(calendar.GoogleCalendarConfig{
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

				meta := ""
				if event.Data != nil {
					meta = fmt.Sprintf(" createdBy=%s cid=%s/%d", event.Data.CreatedBy, event.Data.CustomerSource, event.Data.CustomerID)
				}

				fmt.Fprintf(buf, "- _%s_ %s%s%s%s\n", event.StartTime.Format("15:04"), bold, event.Summary, bold, meta)
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

func getCreateEventCommand() *cobra.Command {
	var (
		dateTimeStr    string
		duration       time.Duration
		summary        string
		description    string
		createdBy      string
		customerID     int
		customerSource string
		animalID       []string
		calID          string
	)
	cmd := &cobra.Command{
		Use: "create",
		Run: func(cmd *cobra.Command, args []string) {
			var data *calendar.StructuredEvent
			if customerSource != "" || createdBy != "" {
				data = &calendar.StructuredEvent{
					CustomerSource: customerSource,
					CustomerID:     customerID,
					AnimalID:       animalID,
					CreatedBy:      createdBy,
				}
			}

			startTime, err := time.ParseInLocation("2006-01-02 15:04", dateTimeStr, time.Local)
			if err != nil {
				log.Fatalf("invalid --at time: %s", err)
			}

			svc := calendarService()
			err = svc.CreateEvent(context.Background(), calID, summary, description, startTime, duration, data)
			if err != nil {
				log.Fatalf("failed to create event: %s", err)
			}
		},
	}
	f := cmd.Flags()
	{
		f.StringVar(&dateTimeStr, "at", "", "Datetime in format yyyy-mm-dd hh:mm")
		f.DurationVar(&duration, "for", 15*time.Minute, "Duration")
		f.StringVar(&summary, "summary", "", "Event summary")
		f.StringVar(&description, "description", "", "Event description")
		f.StringVar(&createdBy, "created-by", "", "User name that created the event")
		f.IntVar(&customerID, "cid", 0, "Customer ID")
		f.StringVar(&customerSource, "customer-source", "", "Customer source")
		f.StringSliceVar(&animalID, "animal-id", nil, "Animal ID")
		f.StringVar(&calID, "calendar", "", "Calendar ID")
	}
	cmd.MarkFlagRequired("at")
	cmd.MarkFlagRequired("summary")
	cmd.MarkFlagRequired("calendar")
	return cmd
}
