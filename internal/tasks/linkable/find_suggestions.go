package linkable

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/nyaruka/phonenumbers"
	"github.com/tierklinik-dobersberg/cis/internal/app"
	"github.com/tierklinik-dobersberg/cis/internal/database/customerdb"
	"github.com/tierklinik-dobersberg/cis/pkg/cache"
	"github.com/tierklinik-dobersberg/cis/pkg/models/customer/v1alpha"
	"github.com/tierklinik-dobersberg/cis/runtime/tasks"
	"github.com/tierklinik-dobersberg/logger"
	"github.com/tierklinik-dobersberg/service/runtime"
	"go.mongodb.org/mongo-driver/bson"
)

type Reason string

var (
	SameName  Reason = "same-name"
	SameMail  Reason = "same-mail"
	SamePhone Reason = "same-phone"
)

type Suggestion struct {
	FalsePositive bool                   `json:"falsePositive,omitempty" bson:"falsePositive,omitempty"`
	Reason        Reason                 `json:"reason,omitempty" bson:"reason,omitempty"`
	Value         string                 `json:"value,omitempty" bson:"value,omitempty"`
	Refs          []*v1alpha.CustomerRef `json:"refs,omitempty" bson:"refs,omitempty"`
	Primary       *v1alpha.CustomerRef   `json:"primary,omitempty" bson:"primary,omitempty"`
}

func (sug *Suggestion) cacheKey() string {
	return fmt.Sprintf("%s%s/%s", CachePrefix, sug.Reason, sug.Value)
}

const CachePrefix = "persist/suggestions/linkable/"

// DeleteSuggestion actually deletes a cache entry for the suggestion identified by
// suggestionKey. Note that the suggestion is likely to get re-created the next time
// FindLinkableCustomers is executed if the root cause of the suggestion did not change.
func DeleteSuggestion(ctx context.Context, app *app.App, suggestionKey string) error {
	if err := app.Cache.Delete(ctx, suggestionKey); err != nil {
		if !errors.Is(err, cache.ErrNotFound) {
			return err
		}
	}
	return nil
}

// MarkFalsePositive marks a customer-link suggestion as false-positive.
func MarkFalsePositive(ctx context.Context, app *app.App, suggestionKey string) error {
	blob, _, err := app.Cache.Read(ctx, suggestionKey)
	if err != nil {
		if errors.Is(err, cache.ErrNotFound) {
			return nil
		}
		return err
	}

	var s Suggestion
	if err := json.Unmarshal(blob, &s); err != nil {
		return err
	}

	s.FalsePositive = true
	blob, err = json.Marshal(s)
	if err != nil {
		return err
	}

	// we don't set a TTL now since we want the "false-positive" entry to
	// survive. If it get's removed for whatever reason it's also no harm.
	// the user just needs to mark it as false-positive again.
	if err := app.Cache.Write(ctx, suggestionKey, blob); err != nil {
		return err
	}
	return nil
}

// LinkCustomers links all customers in suggestion. All customers will be linked
// to primary. If Primary is empty, the customer of the preferred source is
// used as the primary. If no preferred source is available, the first customer
// of the suggestion is used as the primary.
func LinkCustomers(ctx context.Context, app *app.App, suggestion Suggestion) error {
	// first we remove the suggestion from cache as we don't want
	// to retry on the same suggestion in case of an error. If we
	// fail to link the customers further down the same suggestion
	// should be created the next time the task is executed.
	if err := app.Cache.Delete(ctx, suggestion.cacheKey()); err != nil {
		return fmt.Errorf("failed to delete suggestion %q from cache: %w", suggestion.cacheKey(), err)
	}

	// try to find the primary customer. If that fails the suggestion cannot
	// be handled anyway so good we already removed it from the cache.
	primaryRef := suggestion.Primary
	if primaryRef == nil {
		primaryRef = findPrimaryCustomer(app, suggestion.Refs)
		if primaryRef == nil {
			return fmt.Errorf("failed to find primary customer for linking")
		}
	}

	// try to link the customers.
	primary, err := app.Customers.CustomerByCID(ctx, primaryRef.Source, primaryRef.CustomerID)
	if err != nil {
		return fmt.Errorf("failed to load primary: %w", err)
	}
	oid := primary.ID.Hex()

	for _, ref := range suggestion.Refs {
		// skip the primary
		if ref.String() == primaryRef.String() {
			continue
		}

		cus, err := app.Customers.CustomerByCID(ctx, ref.Source, ref.CustomerID)
		if err != nil {
			return fmt.Errorf("failed to resolve customer ref %s: %w", ref, err)
		}
		cus.LinkedTo = oid
		if err := app.Customers.UpdateCustomer(ctx, cus); err != nil {
			return fmt.Errorf("failed to update linked customer %s: %w", ref, err)
		}
	}

	return nil
}

// FindLinkableCustomers searches the complete customer database for
// customer-records that are likely to describe the same contact and
// can therefore be linked together. The found suggestions are persisted
// in the application cache using "persist/suggestions/linkable/<reason>/<value>".
func FindLinkableCustomers(ctx context.Context) error {
	app := app.FromContext(ctx)
	if app == nil {
		return fmt.Errorf("expected app.App to be set on ctx")
	}

	// open a cursor for all customers that do not have
	// a LinkedTo property set.
	cursor, err := app.Customers.Cursor(ctx, bson.M{
		"linkedTo": bson.M{
			"$exists": false,
		}},
	)
	if err != nil {
		return fmt.Errorf("failed to open cursor: %w", err)
	}
	defer cursor.Close(ctx)

	var (
		mail  = make(map[string][]string)
		name  = make(map[string][]string)
		phone = make(map[string][]string)
	)

	appendDistinct := func(m map[string][]string, val string, ref string) {
		val = strings.TrimSpace(val)
		for _, r := range m[val] {
			if r == ref {
				return
			}
		}
		m[val] = append(m[val], ref)
	}

	var i int
	// iterate over all customers and group them by mail, name and
	// phone number
	for cursor.Next(ctx) {
		i++

		if i%100 == 0 {
			logger.From(ctx).Infof("processed %d customer records so far", i)
		}

		var c customerdb.Customer
		if err := cursor.Decode(&c); err != nil {
			return fmt.Errorf("failed to decode customer: %w", err)
		}
		ref := (v1alpha.CustomerRef{
			Source:     c.Source,
			CustomerID: c.CustomerID,
		}).String()

		for _, m := range c.MailAddresses {
			appendDistinct(mail, m, ref)
		}
		fn := c.Name + " " + c.Firstname
		appendDistinct(name, fn, ref)
		for _, p := range c.PhoneNumbers {
			// we still storing each phone number twice using NATIONAL and
			// INTERNATIONAL format. Let's use INTERNATIONAL here.
			//
			// FIXME(ppacher): finally get rid of those two formats and settle
			// on INTERNATIONAL.
			//
			n, err := phonenumbers.Parse(p, app.Config.Country)
			if err != nil {
				// we ignore that error here ...
				continue
			}
			appendDistinct(phone, phonenumbers.Format(n, phonenumbers.INTERNATIONAL), ref)
		}
	}
	if err := cursor.Err(); err != nil {
		return fmt.Errorf("failed to iterate cursor: %w", err)
	}

	createSuggestions := func(reason Reason, m map[string][]string) {
		// range over all groups and create suggestions for each
		for value, refs := range m {
			if len(refs) < 2 {
				continue
			}

			var parsedRefs = make([]*v1alpha.CustomerRef, len(refs))
			for idx, r := range refs {
				parsedRefs[idx] = v1alpha.ParseRef(r)
			}

			sug := Suggestion{
				Reason:  reason,
				Value:   value,
				Refs:    parsedRefs,
				Primary: findPrimaryCustomer(app, parsedRefs),
			}

			// if there's already a suggestion with that key we're not updating
			// it.
			if _, _, err := app.Cache.Read(ctx, sug.cacheKey()); err == nil {
				continue
			}

			blob, err := json.Marshal(sug)
			if err != nil {
				logger.From(ctx).Errorf("failed to marshal suggestion as JSON: %w", err)
				return
			}

			if err := app.Cache.Write(
				ctx,
				sug.cacheKey(),
				blob,
				cache.WithTTL(time.Minute*30),
			); err != nil {
				logger.From(ctx).Errorf("failed to write suggestion to cache: %w", err)
			}

			logger.From(ctx).Infof("found possible linkable customers with %s (%q) in refs: %v", reason, value, refs)
		}
	}

	createSuggestions(SameMail, mail)
	createSuggestions(SamePhone, phone)

	// TODO(ppacher): there are lot's of names that are common
	// so this creates a lot of false-positives. We can consider
	// to use the name similarity (https://github.com/adrg/strutil)
	// to increase the score.
	//
	// createSuggestions(SameName, name)

	return nil
}

// RegisterOn registers a task executing FindLinkableCustomers on
// mng.
func RegisterOn(mng *tasks.Manager) (*tasks.Task, error) {
	t := &tasks.Task{
		Name:     "FindLinkableCustomers",
		TaskFunc: FindLinkableCustomers,
		Deadline: 10 * time.Minute,
		StartNow: true,
		Schedule: "@every 1h",
	}
	if err := mng.Register(t); err != nil {
		return nil, err
	}
	return t, nil
}

func findPrimaryCustomer(app *app.App, refs []*v1alpha.CustomerRef) *v1alpha.CustomerRef {
	if len(refs) == 0 {
		return nil
	}
	for _, c := range refs {
		// TODO(ppacher): make preferred source configurable
		if c.Source == "vetinf" {
			return c
		}
	}
	return refs[0]
}

// We always register on the default manager.
func init() {
	_, err := RegisterOn(tasks.DefaultManager)
	runtime.Must(err)
}
