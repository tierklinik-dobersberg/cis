package calendar

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"path/filepath"
	"strings"
	"time"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/pkglog"
	"github.com/tierklinik-dobersberg/service/svcenv"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/calendar/v3"
)

var log = pkglog.New("calendar")

var ConfigSpec = conf.SectionSpec{
	{
		Name:        "CredentialsFile",
		Type:        conf.StringType,
		Description: "Path to google client credentials",
		Required:    true,
	},
	{
		Name:        "TokenFile",
		Type:        conf.StringType,
		Description: "Path to client token file",
		Required:    true,
	},
}

type Config struct {
	CredentialsFile string
	TokenFile       string
}

// Service allows to read and manipulate google
// calendar events.
type Service interface {
	ListCalendars(ctx context.Context) ([]Calendar, error)
	ListEvents(ctx context.Context, calendarID string, filter *EventSearchOptions) ([]Event, error)
}

type service struct {
	*calendar.Service
}

// New creates a new calendar service from cfg.
func New(cfg Config) (Service, error) {
	creds, err := credsFromFile(cfg.CredentialsFile)
	if err != nil {
		return nil, fmt.Errorf("failed to read credentials file %s: %w", cfg.CredentialsFile, err)
	}

	token, err := tokenFromFile(cfg.TokenFile)
	if err != nil {
		return nil, fmt.Errorf("failed to read token from %s: %w", cfg.TokenFile, err)
	}

	client := creds.Client(context.Background(), token)
	calSvc, err := calendar.New(client)
	if err != nil {
		return nil, err
	}

	svc := &service{
		Service: calSvc,
	}

	return svc, nil
}

// Authenticate retrieves a new token and saves it under TokenFile.
func Authenticate(cfg Config) error {
	creds, err := credsFromFile(cfg.CredentialsFile)
	if err != nil {
		return fmt.Errorf("failed reading %s: %w", cfg.CredentialsFile, err)
	}

	token, err := getTokenFromWeb(creds)
	if err != nil {
		return err
	}

	if err := saveTokenFile(token, cfg.TokenFile); err != nil {
		return err
	}
	return nil
}

func (svc *service) ListCalendars(ctx context.Context) ([]Calendar, error) {
	res, err := svc.Service.CalendarList.List().Do()
	if err != nil {
		return nil, err
	}

	var list = make([]Calendar, len(res.Items))
	for idx, item := range res.Items {
		loc, err := time.LoadLocation(item.TimeZone)
		if err != nil {
			log.From(ctx).Errorf("failed to parse timezone %s from calendar %s", item.TimeZone, item.Id)
		}
		list[idx] = Calendar{
			ID:       item.Id,
			Name:     item.Summary,
			Timezone: item.TimeZone,
			Location: loc,
		}
	}

	return list, nil
}

func (svc *service) ListEvents(ctx context.Context, calendarID string, searchOpts *EventSearchOptions) ([]Event, error) {
	call := svc.Events.List(calendarID).ShowDeleted(false).SingleEvents(true)

	if searchOpts != nil {
		if searchOpts.from != nil {
			call = call.TimeMin(searchOpts.from.Format(time.RFC3339))
		}
		if searchOpts.to != nil {
			call = call.TimeMax(searchOpts.to.Format(time.RFC3339))
		}
	}

	res, err := call.Do()
	if err != nil {
		return nil, err
	}

	var events = make([]Event, len(res.Items))
	for idx, item := range res.Items {
		var (
			err   error
			start time.Time
			end   *time.Time
			data  *StructuredEvent
		)

		if item.Start.DateTime != "" {
			start, err = time.Parse(time.RFC3339, item.Start.DateTime)
		} else {
			start, err = time.Parse("2006-01-02", item.Start.Date)
		}
		if err != nil {
			log.From(ctx).Errorf("failed to parse event start time: %s", err)
			continue
		}

		if !item.EndTimeUnspecified {
			var t time.Time
			if item.End.DateTime != "" {
				t, err = time.Parse(time.RFC3339, item.End.DateTime)
			} else {
				t, err = time.Parse("2006-01-02", item.End.Date)
			}
			if err != nil {
				log.From(ctx).Errorf("failed to parse event end time: %s", err)
				continue
			}
			end = &t
		}

		// TODO(ppacher): add support for freeform text in the description
		// as well by using something like YAML frontmatter
		if item.Description != "" {
			reader := strings.NewReader(item.Description)
			f, err := conf.Deserialize("", reader)
			// TODO(ppacher): we could be more strict here
			if err == nil && f.Sections.Has("CIS") {
				data = new(StructuredEvent)
				err = conf.DecodeSections(f.Sections, StructuredEventSpec, data)
			}

			if err != nil {
				// only log on trace level because we expect this to happen
				// a lot
				log.From(ctx).V(7).Logf("failed to parse description: %s", err)
				data = nil
			}
		}

		events[idx] = Event{
			ID:           item.Id,
			Summary:      strings.TrimSpace(item.Summary),
			Description:  strings.TrimSpace(item.Description),
			StartTime:    start,
			EndTime:      end,
			FullDayEvent: item.Start.DateTime == "" && item.Start.Date != "",
			CalendarID:   calendarID,
			Data:         data,
		}
	}

	return events, nil
}

func tokenFromFile(path string) (*oauth2.Token, error) {
	if !filepath.IsAbs(path) {
		path = filepath.Join(svcenv.Env().ConfigurationDirectory, path)
	}

	content, err := ioutil.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var token oauth2.Token
	if err := json.Unmarshal(content, &token); err != nil {
		return nil, err
	}
	return &token, nil
}

func saveTokenFile(token *oauth2.Token, path string) error {
	if !filepath.IsAbs(path) {
		path = filepath.Join(svcenv.Env().ConfigurationDirectory, path)
	}

	blob, err := json.Marshal(token)
	if err != nil {
		return err
	}

	return ioutil.WriteFile(path, blob, 0600)
}

func credsFromFile(path string) (*oauth2.Config, error) {
	if !filepath.IsAbs(path) {
		path = filepath.Join(svcenv.Env().ConfigurationDirectory, path)
	}

	content, err := ioutil.ReadFile(path)
	if err != nil {
		return nil, err
	}

	config, err := google.ConfigFromJSON(content, calendar.CalendarScope, "https://www.googleapis.com/auth/userinfo.profile")
	if err != nil {
		return nil, err
	}
	return config, nil
}

func getTokenFromWeb(config *oauth2.Config) (*oauth2.Token, error) {
	authURL := config.AuthCodeURL("state-token", oauth2.AccessTypeOffline)
	fmt.Printf("Go to the following link in your browser then type the "+
		"authorization code: \n%v\n", authURL)

	var authCode string
	if _, err := fmt.Scan(&authCode); err != nil {
		return nil, fmt.Errorf("unable to read authorization code: %w", err)
	}

	tok, err := config.Exchange(context.TODO(), authCode)
	if err != nil {
		return nil, fmt.Errorf("unable to retrieve token: %w", err)
	}
	return tok, nil
}
