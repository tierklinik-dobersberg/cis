package voicemail

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"time"

	"github.com/nyaruka/phonenumbers"
	"github.com/tierklinik-dobersberg/cis/internal/database/customerdb"
	"github.com/tierklinik-dobersberg/cis/internal/database/voicemaildb"
	"github.com/tierklinik-dobersberg/cis/pkg/models/voicemail/v1alpha"
	"github.com/tierklinik-dobersberg/cis/pkg/pkglog"
	"github.com/tierklinik-dobersberg/cis/pkg/svcenv"
	"github.com/tierklinik-dobersberg/cis/runtime/mailsync"
	"github.com/tierklinik-dobersberg/mailbox"
	"go.mongodb.org/mongo-driver/bson"
)

var log = pkglog.New("voicemail")

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
	cfg Definition,
	country string,
	mng *mailsync.Manager,
) (*Mailbox, error) {
	syncer, err := mng.NewSyncer(ctx, cfg.Name, 3*time.Minute, &cfg.Config)
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

	if !cfg.Disabled {
		if err := syncer.Start(); err != nil {
			return nil, err
		}
	}

	return box, nil
}

func (box *Mailbox) getCustomer(ctx context.Context, caller string) (customerdb.Customer, error) {
	if caller == "" {
		return customerdb.Customer{}, nil
	}

	parsed, err := phonenumbers.Parse(caller, box.country)
	if err == nil {
		customers, err := box.customers.FilterCustomer(ctx, bson.M{
			"phoneNumbers": bson.M{
				"$in": []string{
					phonenumbers.Format(parsed, phonenumbers.INTERNATIONAL),
					phonenumbers.Format(parsed, phonenumbers.NATIONAL),
				},
			},
		}, false)
		if len(customers) > 0 {
			// TODO(ppacher): what to do on multiple results
			return *customers[0], nil
		}

		if err != nil {
			return customerdb.Customer{}, fmt.Errorf("failed to find customer: %w", err)
		}
	} else {
		return customerdb.Customer{}, fmt.Errorf("failed to parse caller: %w", err)
	}

	return customerdb.Customer{}, fmt.Errorf("unknown customer")
}

func (box *Mailbox) extractData(_ context.Context, mail *mailbox.EMail) (caller, target string) {
	texts := mail.FindByMIME("text/plain")
	if len(texts) == 0 {
		texts = mail.FindByMIME("text/html")
	}

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
			return caller, target
		}
	}

	return caller, target
}

func (box *Mailbox) saveVoiceAttachment(ctx context.Context, caller string, mail *mailbox.EMail) (string, error) {
	log := log.From(ctx)

	var voiceFiles = mail.FindByMIME("application/octet-stream")
	if len(voiceFiles) == 0 {
		return "", fmt.Errorf("no voice recordings found")
	}

	targetDir := filepath.Join(
		svcenv.Env().StateDirectory,
		"voicemails",
	)
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		log.Errorf("failed to create target directory %s: %s", targetDir, err)
		// continue for now, saving the file might still succeed
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
	targetFile, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0644)
	if err != nil {
		return "", fmt.Errorf("failed to create voice file at %s: %w", path, err)
	}

	hasher := sha256.New()
	multiwriter := io.MultiWriter(hasher, targetFile)

	if _, err := multiwriter.Write(voiceFiles[0].Body); err != nil {
		targetFile.Close()

		return "", fmt.Errorf("failed to create voice file at %s: %w", path, err)
	}

	if err := targetFile.Close(); err != nil {
		log.Errorf("failed to close voice file at %s: %s", path, err)
	}

	hash := hex.EncodeToString(hasher.Sum(nil))
	newPath := filepath.Join(
		targetDir,
		fmt.Sprintf("%s%s", hash, filepath.Ext(voiceFiles[0].FileName)),
	)
	if err := os.Rename(path, newPath); err != nil {
		return "", fmt.Errorf("failed to rename voice file from %s to %s: %w", path, newPath, err)
	}

	return newPath, nil
}

// HandleMail implements mailsync.MessageHandler.
func (box *Mailbox) HandleMail(ctx context.Context, mail *mailbox.EMail) {
	log := log.From(ctx)

	caller, target := box.extractData(ctx, mail)

	customer, err := box.getCustomer(ctx, caller)
	if err != nil {
		log.Errorf("caller %s: %s", caller, err)
	}

	filePath, err := box.saveVoiceAttachment(ctx, caller, mail)
	if err != nil {
		log.Errorf("failed to save attachment for caller %s: %s", caller, err)

		return
	}

	record := v1alpha.VoiceMailRecord{
		Filename:       filePath,
		Name:           box.name,
		Date:           time.Now(),
		From:           caller,
		CustomerID:     customer.CustomerID,
		CustomerSource: customer.Source,
	}

	if err := box.voicemails.Create(ctx, &record); err != nil {
		log.Errorf("failed to create voicemail record: %s", err)
	}
	log.Infof("new voicemail from %q at %q stored at %s", caller, target, filePath)
}

// Stop stops the mailbox syncer.
func (box *Mailbox) Stop() error {
	return box.syncer.Stop()
}
