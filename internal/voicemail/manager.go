package voicemail

import (
	"context"
	"fmt"
	"regexp"
	"sync"

	"github.com/ppacher/system-conf/conf"
	"github.com/tierklinik-dobersberg/cis/internal/database/customerdb"
	"github.com/tierklinik-dobersberg/cis/internal/database/voicemaildb"
	"github.com/tierklinik-dobersberg/cis/runtime"
	"github.com/tierklinik-dobersberg/cis/runtime/mailsync"
)

type Manager struct {
	customers   customerdb.Database
	voicemails  voicemaildb.Database
	country     string
	syncManager *mailsync.Manager

	rw        sync.RWMutex
	mailboxes map[string]*Mailbox
}

func NewManager(ctx context.Context, country string, syncManager *mailsync.Manager, customers customerdb.Database, voicemails voicemaildb.Database, rtcfg *runtime.ConfigSchema) (*Manager, error) {
	mng := &Manager{
		syncManager: syncManager,
		country:     country,
		customers:   customers,
		voicemails:  voicemails,
		mailboxes:   make(map[string]*Mailbox),
	}

	rtcfg.AddValidator(mng, "VoiceMail")
	rtcfg.AddNotifier(mng, "VoiceMail")

	sections, err := rtcfg.All(ctx, "VoiceMail")
	if err != nil {
		return nil, fmt.Errorf("failed to get existing mailboxes: %w", err)
	}
	for _, def := range sections {
		if err := mng.NotifyChange(ctx, "create", def.ID, &def.Section); err != nil {
			return nil, fmt.Errorf("failed to create box %s: %w", def.ID, err)
		}
	}

	return mng, nil
}

func (mng *Manager) Validate(ctx context.Context, sec runtime.Section) error {
	// first try to decoded the section according to the spec.
	var def Definition
	if err := sec.Decode(Spec, &def); err != nil {
		return err
	}

	// next, check if the provided regular expressions can actually be
	// compiled

	if def.ExtractCallerRegexp != "" {
		if _, err := regexp.Compile(def.ExtractCallerRegexp); err != nil {
			return fmt.Errorf("ExtractCallerRegexp: %w", err)
		}
	}

	if def.ExtractTargetRegexp != "" {
		if _, err := regexp.Compile(def.ExtractTargetRegexp); err != nil {
			return fmt.Errorf("ExtractTargetRegexp: %w", err)
		}
	}

	return nil
}

func (mng *Manager) NotifyChange(ctx context.Context, changeType, id string, sec *conf.Section) error {
	mng.rw.Lock()
	defer mng.rw.Unlock()

	// an "update" event is - for simplicity - handled like a "delete" and "create" here

	if changeType != "create" {
		box, ok := mng.mailboxes[id]
		if ok {
			// we can safely ignore the error here because
			// it may only ever be "not running"
			_ = box.Dispose()
			delete(mng.mailboxes, id)

			log.From(ctx).Infof("deleted mailbox %s (changeType=%s)", id, changeType)
		}
	}

	if changeType != "delete" {
		var def Definition
		if err := conf.DecodeSections([]conf.Section{*sec}, Spec, &def); err != nil {
			return err
		}

		if err := mng.createBox(ctx, id, def); err != nil {
			return err
		}

		log.From(ctx).Infof("created new mailbox %s (changeType=%s)", id, changeType)
	}

	return nil
}

func (mng *Manager) createBox(ctx context.Context, id string, def Definition) error {
	box, err := New(ctx, mng.customers, mng.voicemails, mng.country, def, mng.syncManager)
	if err != nil {
		return err
	}

	mng.mailboxes[id] = box

	return nil
}
