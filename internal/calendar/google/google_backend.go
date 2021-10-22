package google

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/ppacher/system-conf/conf"
	ciscal "github.com/tierklinik-dobersberg/cis/internal/calendar"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
	"github.com/tierklinik-dobersberg/logger"
	"github.com/tierklinik-dobersberg/service/svcenv"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"golang.org/x/sync/singleflight"
	"google.golang.org/api/calendar/v3"
	"google.golang.org/api/option"
)

var log = pkglog.New("calendar")

var GoogleConfigSpec = conf.SectionSpec{
	{
		Name:        "Enabled",
		Type:        conf.BoolType,
		Description: "Whether or not google calendar integration is enabled",
		Default:     "no",
	},
	{
		Name:        "CredentialsFile",
		Type:        conf.StringType,
		Description: "Path to google client credentials",
		Default:     "google-credentials.json",
	},
	{
		Name:        "TokenFile",
		Type:        conf.StringType,
		Description: "Path to client token file",
		Default:     "token.json",
	},
	{
		Name:        "IgnoreCalendar",
		Type:        conf.StringSliceType,
		Description: "A list of Google calendar IDs to ingore",
	},
}

type GoogleCalendarConfig struct {
	Enabled         bool
	CredentialsFile string
	TokenFile       string
	IgnoreCalendar  []string
	Location        *time.Location
}

// Service allows to read and manipulate google
// calendar events.
type Service interface {
	ListCalendars(ctx context.Context) ([]ciscal.Calendar, error)
	ListEvents(ctx context.Context, calendarID string, filter *ciscal.EventSearchOptions) ([]ciscal.Event, error)
	CreateEvent(ctx context.Context, calId, name, description string, startTime time.Time, duration time.Duration, data *ciscal.StructuredEvent) error
	DeleteEvent(ctx context.Context, calID, eventId string) error
}

type googleCalendarBackend struct {
	*calendar.Service
	location        *time.Location
	ignoreCalendars []string

	cacheLock   sync.Mutex
	eventsCache map[string]*googleEventCache
	loadGroup   singleflight.Group
}

// New creates a new calendar service from cfg.
func New(ctx context.Context, cfg GoogleCalendarConfig) (Service, error) {
	if !cfg.Enabled {
		return &noopBackend{}, nil
	}

	creds, err := credsFromFile(cfg.CredentialsFile)
	if err != nil {
		return nil, fmt.Errorf("failed to read credentials file %s: %w", cfg.CredentialsFile, err)
	}

	token, err := tokenFromFile(cfg.TokenFile)
	if err != nil {
		return nil, fmt.Errorf("failed to read token from %s: %w", cfg.TokenFile, err)
	}

	client := creds.Client(ctx, token)
	calSvc, err := calendar.NewService(ctx, option.WithHTTPClient(client))
	if err != nil {
		return nil, fmt.Errorf("failed to create calendar client: %w", err)
	}

	svc := &googleCalendarBackend{
		Service:         calSvc,
		eventsCache:     make(map[string]*googleEventCache),
		location:        cfg.Location,
		ignoreCalendars: cfg.IgnoreCalendar,
	}
	if svc.location == nil {
		svc.location = time.Local
	}

	// create a new eventCache for each calendar right now
	if _, err := svc.ListCalendars(ctx); err != nil {
		log.From(ctx).Errorf("failed to start watching calendars: %s", err)
	}

	return svc, nil
}

// Authenticate retrieves a new token and saves it under TokenFile.
func Authenticate(cfg GoogleCalendarConfig) error {
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

func (svc *googleCalendarBackend) ListCalendars(ctx context.Context) ([]ciscal.Calendar, error) {
	res, err := svc.Service.CalendarList.List().ShowHidden(true).Do()
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve list of calendars: %w", err)
	}

	var list = make([]ciscal.Calendar, 0, len(res.Items))
	for _, item := range res.Items {
		loc, err := time.LoadLocation(item.TimeZone)
		if err != nil {
			log.From(ctx).Errorf("failed to parse timezone %s from calendar %s", item.TimeZone, item.Id)
		}

		// check if the calendar should be ingored based on IngoreCalendar=
		if svc.shouldIngore(item) {
			continue
		}

		list = append(list, ciscal.Calendar{
			ID:       item.Id,
			Name:     item.Summary,
			Timezone: item.TimeZone,
			Location: loc,
		})
		// immediately prepare the calendar cache
		if _, err = svc.cacheFor(ctx, item.Id); err != nil {
			log.From(ctx).Errorf("failed to perpare calendar event cache for %s: %s", item.Id, err)
		}
	}

	return list, nil
}

func (svc *googleCalendarBackend) ListEvents(ctx context.Context, calendarID string, searchOpts *ciscal.EventSearchOptions) ([]ciscal.Event, error) {
	cache, err := svc.cacheFor(ctx, calendarID)
	if err != nil {
		log.From(ctx).Errorf("failed to get event cache for calendar %s: %s", calendarID, err)
	}

	if cache != nil {
		events, ok := cache.tryLoadFromCache(ctx, searchOpts)
		if ok {
			return events, nil
		}
		log.From(ctx).V(7).Logf("cache miss when loading events for %s", calendarID)
	}

	return svc.loadEvents(ctx, calendarID, searchOpts)
}

func (svc *googleCalendarBackend) CreateEvent(ctx context.Context, calId, name, description string, startTime time.Time, duration time.Duration, data *ciscal.StructuredEvent) error {
	// convert structured event data to it's string representation
	// and append to description.
	if data != nil {
		metaFile, err := conf.ConvertToFile(struct {
			Data *ciscal.StructuredEvent `section:"CIS"`
		}{data}, "")
		if err != nil {
			return fmt.Errorf("failed to marshal as config: %w", err)
		}
		buf := new(bytes.Buffer)
		if err := conf.WriteSectionsTo(metaFile.Sections, buf); err != nil {
			return fmt.Errorf("failed to write sections: %w", err)
		}
		description = strings.TrimSpace(description) + "\n\n" + buf.String()
	}

	res, err := svc.Service.Events.Insert(calId, &calendar.Event{
		Summary:     name,
		Description: description,
		Start: &calendar.EventDateTime{
			DateTime: startTime.Format(time.RFC3339),
		},
		End: &calendar.EventDateTime{
			DateTime: startTime.Add(duration).Format(time.RFC3339),
		},
		Status: "confirmed",
	}).Do()
	if err != nil {
		return fmt.Errorf("failed to insert event upstream: %w", err)
	}
	log.From(ctx).Infof("created event with id %s", res.Id)

	if cache, _ := svc.cacheFor(ctx, calId); cache != nil {
		cache.triggerSync()
	}
	return nil
}

func (svc *googleCalendarBackend) DeleteEvent(ctx context.Context, calid, eventid string) error {
	err := svc.Service.Events.Delete(calid, eventid).Do()
	if err != nil {
		return fmt.Errorf("failed to delete event upstream: %w", err)
	}
	return nil
}

func (svc *googleCalendarBackend) cacheFor(ctx context.Context, calid string) (*googleEventCache, error) {
	svc.cacheLock.Lock()
	defer svc.cacheLock.Unlock()

	cache, ok := svc.eventsCache[calid]
	if ok {
		log.From(ctx).V(8).Logf("using existing event cache for %s", calid)
		return cache, nil
	}

	ctx = logger.WithFields(ctx, logger.Fields{
		"calendarID": calid,
	})
	cache, err := newCache(ctx, calid, svc.location, svc.Service)
	if err != nil {
		return nil, err
	}

	svc.eventsCache[calid] = cache
	log.From(ctx).V(7).Logf("created new event cache for calendar %s", calid)
	return cache, nil
}

func (svc *googleCalendarBackend) loadEvents(ctx context.Context, calendarID string, searchOpts *ciscal.EventSearchOptions) ([]ciscal.Event, error) {
	call := svc.Events.List(calendarID).ShowDeleted(false).SingleEvents(true)

	key := calendarID
	if searchOpts != nil {
		if searchOpts.FromTime != nil {
			call = call.TimeMin(searchOpts.FromTime.Format(time.RFC3339))
			key += fmt.Sprintf("-%s", searchOpts.FromTime.Format(time.RFC3339))
		}
		if searchOpts.ToTime != nil {
			call = call.TimeMax(searchOpts.ToTime.Format(time.RFC3339))
			key += fmt.Sprintf("-%s", searchOpts.ToTime.Format(time.RFC3339))
		}
	}

	res, err, shared := svc.loadGroup.Do(key, func() (interface{}, error) {
		var events []ciscal.Event
		var pageToken string
		for {
			if pageToken != "" {
				call.PageToken(pageToken)
			}
			res, err := call.Do()
			if err != nil {
				return nil, fmt.Errorf("failed to retreive page from upstream: %w", err)
			}

			for _, item := range res.Items {
				evt, err := convertToEvent(ctx, calendarID, item)
				if err != nil {
					log.From(ctx).Errorf(err.Error())
					continue
				}
				events = append(events, *evt)
			}

			if res.NextPageToken != "" {
				pageToken = res.NextPageToken
				continue
			}
			break
		}

		return events, nil
	})
	svc.loadGroup.Forget(key)
	if shared {
		log.From(ctx).V(7).Logf("shared calendar load between multiple callers")
	}

	return res.([]ciscal.Event), err // nolint:wrapcheck // this one is already wrapped
}

func (svc *googleCalendarBackend) shouldIngore(item *calendar.CalendarListEntry) bool {
	for _, value := range svc.ignoreCalendars {
		if item.Id == value {
			return true
		}
	}
	return false
}

func tokenFromFile(path string) (*oauth2.Token, error) {
	if !filepath.IsAbs(path) {
		path = filepath.Join(svcenv.Env().ConfigurationDirectory, path)
	}

	content, err := ioutil.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	var token oauth2.Token
	if err := json.Unmarshal(content, &token); err != nil {
		return nil, fmt.Errorf("failed to unmarshal JSON token: %w", err)
	}
	return &token, nil
}

func saveTokenFile(token *oauth2.Token, path string) error {
	if !filepath.IsAbs(path) {
		path = filepath.Join(svcenv.Env().ConfigurationDirectory, path)
	}

	blob, err := json.Marshal(token)
	if err != nil {
		return fmt.Errorf("failed to marshal JSON token: %w", err)
	}

	return ioutil.WriteFile(path, blob, 0600)
}

func credsFromFile(path string) (*oauth2.Config, error) {
	if !filepath.IsAbs(path) {
		path = filepath.Join(svcenv.Env().ConfigurationDirectory, path)
	}

	content, err := ioutil.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	config, err := google.ConfigFromJSON(content, calendar.CalendarScope, "https://www.googleapis.com/auth/userinfo.profile")
	if err != nil {
		return nil, fmt.Errorf("failed to get configuration from JSON: %w", err)
	}
	return config, nil
}

func getTokenFromWeb(config *oauth2.Config) (*oauth2.Token, error) {
	authURL := config.AuthCodeURL("state-token", oauth2.AccessTypeOffline)
	fmt.Printf("Go to the following link in your browser then type the "+ //nolint:forbidigo
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
