package calendar

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
	"github.com/tierklinik-dobersberg/cis/internal/pkglog"
	"github.com/tierklinik-dobersberg/logger"
	"github.com/tierklinik-dobersberg/service/svcenv"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"golang.org/x/sync/singleflight"
	"google.golang.org/api/calendar/v3"
)

var log = pkglog.New("calendar")

var ConfigSpec = conf.SectionSpec{
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
}

type Config struct {
	Enabled         bool
	CredentialsFile string
	TokenFile       string
	Location        *time.Location
}

// Service allows to read and manipulate google
// calendar events.
type Service interface {
	ListCalendars(ctx context.Context) ([]Calendar, error)
	ListEvents(ctx context.Context, calendarID string, filter *EventSearchOptions) ([]Event, error)
	CreateEvent(ctx context.Context, calId, name, description string, startTime time.Time, duration time.Duration, data *StructuredEvent) error
	DeleteEvent(ctx context.Context, calID, eventId string) error
}

type googleCalendarBackend struct {
	*calendar.Service
	location *time.Location

	cacheLock   sync.Mutex
	eventsCache map[string]*googleEventCache
	loadGroup   singleflight.Group
}

// New creates a new calendar service from cfg.
func New(cfg Config) (Service, error) {
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

	client := creds.Client(context.Background(), token)
	calSvc, err := calendar.New(client)
	if err != nil {
		return nil, err
	}

	svc := &googleCalendarBackend{
		Service:     calSvc,
		eventsCache: make(map[string]*googleEventCache),
		location:    cfg.Location,
	}
	if svc.location == nil {
		svc.location = time.Local
	}

	// create a new eventCache for each calendar right now
	ctx := context.TODO()
	if _, err := svc.ListCalendars(ctx); err != nil {
		log.From(ctx).Errorf("failed to start watching calendars: %s", err)
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

func (svc *googleCalendarBackend) ListCalendars(ctx context.Context) ([]Calendar, error) {
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
		// immediately prepare the calendar cache
		if _, err = svc.cacheFor(ctx, item.Id); err != nil {
			log.From(ctx).Errorf("failed to perpare calendar event cache for %s: %s", item.Id, err)
		}
	}

	return list, nil
}

func (svc *googleCalendarBackend) ListEvents(ctx context.Context, calendarID string, searchOpts *EventSearchOptions) ([]Event, error) {
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

func (svc *googleCalendarBackend) CreateEvent(ctx context.Context, calId, name, description string, startTime time.Time, duration time.Duration, data *StructuredEvent) error {
	// convert structured event data to it's string representation
	// and append to description.
	if data != nil {
		metaFile, err := conf.ConvertToFile(struct {
			Data *StructuredEvent `section:"CIS"`
		}{data}, "")
		if err != nil {
			return err
		}
		buf := new(bytes.Buffer)
		if err := conf.WriteSectionsTo(metaFile.Sections, buf); err != nil {
			return err
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
		return err
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
		return err
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

func (svc *googleCalendarBackend) loadEvents(ctx context.Context, calendarID string, searchOpts *EventSearchOptions) ([]Event, error) {
	call := svc.Events.List(calendarID).ShowDeleted(false).SingleEvents(true)

	key := calendarID
	if searchOpts != nil {
		if searchOpts.from != nil {
			call = call.TimeMin(searchOpts.from.Format(time.RFC3339))
			key += fmt.Sprintf("-%s", searchOpts.from.Format(time.RFC3339))
		}
		if searchOpts.to != nil {
			call = call.TimeMax(searchOpts.to.Format(time.RFC3339))
			key += fmt.Sprintf("-%s", searchOpts.to.Format(time.RFC3339))
		}
	}

	res, err, shared := svc.loadGroup.Do(key, func() (interface{}, error) {
		var events []Event
		var pageToken string
		for {
			if pageToken != "" {
				call.PageToken(pageToken)
			}
			res, err := call.Do()
			if err != nil {
				return nil, err
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

	return res.([]Event), err
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
