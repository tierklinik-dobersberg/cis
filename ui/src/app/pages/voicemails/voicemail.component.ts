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
import { provideIcons } from '@ng-icons/core';
import { lucideFileAudio, lucidePlayCircle } from '@ng-icons/lucide';
import { HlmCardModule } from '@tierklinik-dobersberg/angular/card';
import { HlmCheckboxModule } from '@tierklinik-dobersberg/angular/checkbox';
import { HlmIconModule } from '@tierklinik-dobersberg/angular/icon';
import { HlmTableModule } from '@tierklinik-dobersberg/angular/table';
import { toast } from 'ngx-sonner';
import {
  forkJoin,
  Observable,
  of
} from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';
import { SearchParams, VoiceMailAPI, VoiceMailRecording } from 'src/app/api';
import { Customer, CustomerAPI } from 'src/app/api/customer.api';
import {
  TkdDatePickerComponent,
  TkdDatePickerInputDirective,
} from 'src/app/components/date-picker';
import { TkdDatePickerTriggerComponent } from 'src/app/components/date-picker/picker-trigger';
import { HeaderTitleService } from 'src/app/layout/header-title';
import { extractErrorMessage } from 'src/app/utils';

interface VoiceMailWithCustomer extends VoiceMailRecording {
  customer?: Customer;
  playing: boolean;
}

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
    DatePipe
  ],
  providers: [...provideIcons({ lucideFileAudio, lucidePlayCircle })],
})
export class VoiceMailComponent {
  private readonly header = inject(HeaderTitleService);
  private readonly voicemailsapi = inject(VoiceMailAPI);
  private readonly customersapi = inject(CustomerAPI);
  private readonly route = inject(ActivatedRoute);

  protected readonly recordings = signal<VoiceMailWithCustomer[]>([]);
  protected readonly onlyUnseen = signal(false);
  protected readonly date = signal<Date | null>(null);
  protected readonly loading = signal(true);
  protected readonly mailbox = signal('');

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const name = params.get('name');
      if (!name) {
        return;
      }

      this.mailbox.set(name);
    });

    effect(
      () => {
        const name = this.mailbox();
        const date = this.date();
        const onlyUnseen = this.onlyUnseen();

        this.loading.set(true);
        this.header.set(name);

        const opts: SearchParams = {
          name,
        };
        if (date !== null) {
          opts.date = date;
        }

        if (onlyUnseen) {
          opts.seen = false;
        }

        this.voicemailsapi
          .search(opts)
          .pipe(
            mergeMap(recordings => {
              const m = new Map<string, [string, number]>();
              recordings.forEach(rec => {
                if (!rec.customerSource) {
                  return;
                }
                m.set(`${rec.customerSource}/${rec.customerID}`, [
                  rec.customerSource,
                  rec.customerID,
                ]);
              });

              const observables: {
                recordings: Observable<VoiceMailRecording[]>;
                [key: string]: Observable<any>;
              } = {
                recordings: of(recordings),
              };

              Array.from(m.entries()).forEach(([key, [source, id]]) => {
                observables[key] = this.customersapi
                  .byId(source, id)
                  .pipe(catchError(() => of(null as Customer)));
              });

              return forkJoin(observables);
            })
          )
          .subscribe((result: { [key: string]: any }) => {
            const records = result.recordings.map(record => {
              return {
                ...record,
                customer:
                  result[`${record.customerSource}/${record.customerID}`],
              };
            });

            this.recordings.set(records);
            this.loading.set(false);
          });
      },
      { allowSignalWrites: true }
    );
  }

  protected playRecording(
    rec: VoiceMailWithCustomer,
    player?: HTMLAudioElement
  ): void {
    player = new Audio(rec.url);
    player.autoplay = false;
    player.muted = false;
    player.volume = 1;

    player.onended = () => {
      this.changeSeen(rec, true);
      rec.playing = false;
    };

    player
      .play()
      .then(() => {
        rec.playing = true;
      })
      .catch(err => {
        toast.error(
          extractErrorMessage(err, 'Datei konnte nicht abgespielt werden')
        );
      });
  }

  protected changeSeen(rec: VoiceMailRecording, seen: boolean): void {
    this.voicemailsapi.updateSeen(rec._id, seen).subscribe({
      next: () => (rec.read = seen),
      error: err => {
        toast.error('Aufnahme konnte nicht als gesehen markiert werden');
      },
    });
  }
}
