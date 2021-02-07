package voicemail

import (
	"context"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"regexp"
	"time"

	"github.com/nyaruka/phonenumbers"
	"github.com/tierklinik-dobersberg/cis/internal/database/customerdb"
	"github.com/tierklinik-dobersberg/cis/internal/database/voicemaildb"
	"github.com/tierklinik-dobersberg/cis/internal/mailsync"
	"github.com/tierklinik-dobersberg/cis/internal/schema"
	"github.com/tierklinik-dobersberg/cis/pkg/models/voicemail/v1alpha"
	"github.com/tierklinik-dobersberg/logger"
	"github.com/tierklinik-dobersberg/mailbox"
	"github.com/tierklinik-dobersberg/service/svcenv"
	"go.mongodb.org/mongo-driver/bson"
)

// Mailbox handles voicmails.
type Mailbox struct {
	syncer       *mailsync.Syncer
	callerRegexp *regexp.Regexp
	targetRegexp *regexp.Regexp
	customers    customerdb.Database
	voicemails   voicemaildb.Database
	name         string
	country      string
}

// New creates a new voicmail mailbox.
func New(
	ctx context.Context,
	customers customerdb.Database,
	voicemails voicemaildb.Database,
	cfg schema.VoiceMail,
	country string,
	mng *mailsync.Manager,
) (*Mailbox, error) {
	syncer, err := mng.NewSyncer(ctx, cfg.Name, 5*time.Minute, &cfg.Config)
	if err != nil {
		return nil, err
	}

	box := &Mailbox{
		syncer:     syncer,
		name:       cfg.Name,
		customers:  customers,
		voicemails: voicemails,
		country:    country,
	}
	syncer.OnMessage(box)

	if cfg.ExtractCallerRegexp != "" {
		box.callerRegexp, err = regexp.Compile(cfg.ExtractCallerRegexp)
		if err != nil {
			return nil, fmt.Errorf("invalid caller regexp: %w", err)
		}
	}

	if cfg.ExtractTargetRegexp != "" {
		box.targetRegexp, err = regexp.Compile(cfg.ExtractTargetRegexp)
		if err != nil {
			return nil, fmt.Errorf("invalid target regexp: %w", err)
		}
	}

	if err := syncer.Start(); err != nil {
		return nil, err
	}

	return box, nil
}

// HandleMail implements mailsync.MessageHandler.
func (box *Mailbox) HandleMail(ctx context.Context, mail *mailbox.EMail) {
	log := logger.From(ctx)

	texts := mail.FindByMIME("text/plain")
	if len(texts) == 0 {
		texts = mail.FindByMIME("text/html")
	}

	var caller string
	var target string

	for _, part := range texts {
		if caller == "" && box.callerRegexp != nil {
			matches := box.callerRegexp.FindStringSubmatch(string(part.Body))
			if len(matches) >= 2 {
				caller = matches[1]
			}
		}

		if target == "" && box.targetRegexp != nil {
			matches := box.targetRegexp.FindStringSubmatch(string(part.Body))
			if len(matches) >= 2 {
				target = matches[1]
			}
		}

		if target != "" && caller != "" {
			break
		}
	}

	var voiceFiles = mail.FindByMIME("application/octet-stream")
	if len(voiceFiles) == 0 {
		log.Errorf("no voice recordings found")
		return
	}

	var customer customerdb.Customer
	if caller != "" {
		parsed, err := phonenumbers.Parse(caller, box.country)
		if err == nil {
			customers, err := box.customers.FilterCustomer(ctx, bson.M{
				"phoneNumbers": bson.M{
					"$in": []string{
						phonenumbers.Format(parsed, phonenumbers.INTERNATIONAL),
						phonenumbers.Format(parsed, phonenumbers.NATIONAL),
					},
				},
			})
			if err == nil {
				if len(customers) > 0 {
					// TODO(ppacher): what to do on multiple results
					customer = *customers[0]
				}
			} else {
				log.Errorf("failed to find customer for %s: %s", caller, err)
			}
		} else {
			log.Errorf("failed to parse caller number: %s", err)
		}
	}

	targetDir := filepath.Join(
		svcenv.Env().StateDirectory,
		"voicemails",
	)
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		log.Errorf("failed to create target directory %s: %s", targetDir, err)
	}

	fileName := fmt.Sprintf(
		"%s-%s%s",
		time.Now().Format(time.RFC3339),
		caller,
		filepath.Ext(voiceFiles[0].FileName),
	)
	path := filepath.Join(
		targetDir,
		fileName,
	)

	if err := ioutil.WriteFile(path, voiceFiles[0].Body, 0644); err != nil {
		log.Errorf("failed to write voice file to %s: %s", path, err)
		return
	}

	record := v1alpha.VoiceMailRecord{
		Filename:       path,
		Name:           box.name,
		Date:           time.Now(),
		From:           caller,
		CustomerID:     customer.CustomerID,
		CustomerSource: customer.Source,
	}

	if err := box.voicemails.Create(ctx, &record); err != nil {
		log.Errorf("failed to create voicemail record: %s", err)
	}
	log.Infof("new voicemail from %q at %q stored at %s (%d bytes)", caller, target, path, len(voiceFiles[0].Body))
}

// Stop stops the mailbox syncer.
func (box *Mailbox) Stop() error {
	return box.syncer.Stop()
}
