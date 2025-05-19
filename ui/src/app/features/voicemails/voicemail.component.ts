import { DatePipe } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    effect,
    inject,
    signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { PartialMessage, Timestamp } from '@bufbuild/protobuf';
import { ConnectError } from '@connectrpc/connect';
import { provideIcons } from '@ng-icons/core';
import { lucideCirclePlay, lucideFileAudio } from '@ng-icons/lucide';
import { BrnTooltipModule } from '@spartan-ng/ui-tooltip-brain';
import { HlmBadgeDirective } from '@tierklinik-dobersberg/angular/badge';
import { HlmButtonDirective } from '@tierklinik-dobersberg/angular/button';
import { HlmCardModule } from '@tierklinik-dobersberg/angular/card';
import { HlmCheckboxModule } from '@tierklinik-dobersberg/angular/checkbox';
import { injectVoiceMailService } from '@tierklinik-dobersberg/angular/connect';
import { HlmIconModule } from '@tierklinik-dobersberg/angular/icon';
import { ToDatePipe } from '@tierklinik-dobersberg/angular/pipes';
import { HlmTableModule } from '@tierklinik-dobersberg/angular/table';
import { HlmTooltipModule } from '@tierklinik-dobersberg/angular/tooltip';
import { ListMailboxesResponse, ListVoiceMailsRequest, ListVoiceMailsResponse, Mailbox, VoiceMail, VoiceMailReceivedEvent } from '@tierklinik-dobersberg/apis/pbx3cx/v1';
import { isAfter, isBefore } from 'date-fns';
import { toast } from 'ngx-sonner';
import {
    TkdDatePickerComponent,
    TkdDatePickerInputDirective,
} from 'src/app/components/date-picker';
import { TkdDatePickerTriggerComponent } from 'src/app/components/date-picker/picker-trigger';
import { HeaderTitleService } from 'src/app/layout/header-title';
import { EventService } from 'src/app/services/event.service';
import { extractErrorMessage } from 'src/app/utils';
import { environment } from 'src/environments/environment';

@Component({
  templateUrl: './voicemail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    HlmIconModule,
    HlmCardModule,
    TkdDatePickerComponent,
    TkdDatePickerTriggerComponent,
    TkdDatePickerInputDirective,
    HlmTableModule,
    HlmCheckboxModule,
    FormsModule,
    ToDatePipe,
    HlmButtonDirective,
    HlmBadgeDirective,
    DatePipe,
    HlmTooltipModule,
    BrnTooltipModule,
    HlmTooltipModule,
    BrnTooltipModule
  ],
  providers: [...provideIcons({ lucideFileAudio, lucideCirclePlay })],
})
export class VoiceMailComponent {
  private readonly header = inject(HeaderTitleService);
  private readonly route = inject(ActivatedRoute);

  private voiceMailService  = injectVoiceMailService();

  protected readonly recordings = signal<VoiceMail[]>([]);
  protected readonly onlyUnseen = signal(false);
  protected readonly dateRange = signal<[Date, Date | null] | null>(null);
  protected readonly loading = signal(true);
  protected readonly mailbox = signal<Mailbox | null>(null)

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const name = params.get('name');
      if (!name) {
        this.mailbox.set(null);
        return;
      }

      this.voiceMailService
        .listMailboxes({})
        .catch(err => {
          toast.error('Failed to load mailboxes', {
            description: ConnectError.from(err).message
          })

          return new ListMailboxesResponse()
        })
        .then(response => {
          this.mailbox.set(response.mailboxes?.find(m => m.id === name) || null)
        })
    });

    inject(EventService)
      .subscribe([new VoiceMailReceivedEvent])
      .pipe(takeUntilDestroyed())
      .subscribe(event => {
        const range = this.dateRange();

        if (range !== null && (range[0] || range[1]) ) {
          if (range[0] && isBefore(range[0], event.voicemail.receiveTime.toDate())) {
            return
          }

          if (range[1] && isAfter(range[1], event.voicemail.receiveTime.toDate())) {
            return
          }
        }

        const values = this.recordings();
        [...values].splice(0, 0, event.voicemail)
        this.recordings.set(values);
      })

    effect(
      () => {
        const mb = this.mailbox();
        const range = this.dateRange();
        const onlyUnseen = this.onlyUnseen();

        if (!mb) {
          return
        }

        this.loading.set(true);
        this.header.set(mb.displayName);

        const req: PartialMessage<ListVoiceMailsRequest> = {
          mailbox: mb.id,
          filter: {}
        }

        if (range !== null && (range[0] || range[1])) {
          req.filter.timeRange = {
            from: range[0] ? Timestamp.fromDate(range[0]) : undefined,
            to: range[1] ? Timestamp.fromDate(range[1]) : undefined,
          }
        }

        if (onlyUnseen) {
          req.filter.unseen = true
        }

        if (Object.keys(req.filter).length === 0) {
          req.filter = undefined;
        }

        this.voiceMailService
          .listVoiceMails(req)
          .catch(err => {
            toast.error('Voice-Mails konnten nicht geladen werden', {
              description: ConnectError.from(err).message
            })

            return new ListVoiceMailsResponse()
          })
          .then(response => {
            this.recordings.set(response.voicemails || []);
            this.loading.set(false);
          })
      },
      { allowSignalWrites: true }
    );
  }

  protected playRecording(
    rec: VoiceMail,
    player?: HTMLAudioElement
  ): void {
    player = new Audio(`${environment.callService}/voicemails/?id=${rec.id}`)
    player.autoplay = false;
    player.muted = false;
    player.volume = 1;

    player.onended = () => {
      this.changeSeen(rec, true);
    };

    player
      .play()
      .catch(err => {
        toast.error(
          extractErrorMessage(err, 'Datei konnte nicht abgespielt werden')
        );
      });
  }

  protected changeSeen(rec: VoiceMail, seen: boolean): void {
    this.voiceMailService
      .markVoiceMails({
        seen: seen,
        voicemailIds: [rec.id],
      })
      .catch(err => {
        toast.error('Voice-Mail konnte nicht als gelesen markiert werden', {
          description: ConnectError.from(err).message,
        })
      })
      .then(() => {
        this.mailbox.set(new Mailbox(this.mailbox()))
      })
  }
}
