import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { BehaviorSubject, combineLatest, forkJoin, Observable, of, Subscription } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';
import { SearchParams, VoiceMailAPI, VoiceMailRecording } from 'src/app/api';
import { Customer, CustomerAPI } from 'src/app/api/customer.api';
import { LayoutService } from 'src/app/services';
import { HeaderTitleService } from 'src/app/shared/header-title';
import { extractErrorMessage } from 'src/app/utils';

interface VoiceMailWithCustomer extends VoiceMailRecording {
  customer?: Customer;
  playing: boolean;
}

@Component({
  templateUrl: './voicemail.component.html',
  styleUrls: ['./voicemail.component.scss'],
})
export class VoiceMailComponent implements OnInit, OnDestroy {
  private subscriptions = Subscription.EMPTY;
  private date$ = new BehaviorSubject<Date | null>(null);
  private onlyUnseen$ = new BehaviorSubject<boolean>(true);
  loading = false;

  get onlyUnseen(): boolean {
    return this.onlyUnseen$.getValue();
  }

  get date(): Date | null {
    return this.date$.getValue();
  }

  recordings: VoiceMailWithCustomer[] = [];

  constructor(
    private header: HeaderTitleService,
    private voicemailsapi: VoiceMailAPI,
    private customersapi: CustomerAPI,
    private route: ActivatedRoute,
    private nzMessage: NzMessageService,
    public layout: LayoutService,
  ) { }

  onChange(date?: Date, unseen?: boolean): void {
    if (date !== undefined) {
      this.date$.next(date);
    }

    if (unseen !== undefined) {
      this.onlyUnseen$.next(unseen);
    }
  }

  ngOnInit(): void {
    this.subscriptions = new Subscription();

    const paramSub =
      combineLatest([
        this.route.paramMap,
        this.date$,
        this.onlyUnseen$,
      ])
        .pipe(
          mergeMap(([params, date, onlyUnseen]) => {
            this.loading = true;
            const name = params.get('name');
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

            return this.voicemailsapi.search(opts);
          }),
          mergeMap(recordings => {
            const m = new Map<string, [string, number]>();
            recordings.forEach(rec => {
              if (!rec.customerSource) {
                return;
              }
              m.set(`${rec.customerSource}/${rec.customerID}`, [rec.customerSource, rec.customerID]);
            });

            const observables: {
              recordings: Observable<VoiceMailRecording[]>;
              [key: string]: Observable<any>;
            } = {
              recordings: of(recordings),
            };

            Array.from(m.entries()).forEach(([key, [source, id]]) => {
              observables[key] = this.customersapi.byId(source, id)
                .pipe(catchError(() => of(null as Customer)));
            });

            return forkJoin(observables);
          })
        )
        .subscribe((result: { [key: string]: any }) => {
          this.recordings = result.recordings.map(record => {
            return {
              ...record,
              customer: result[`${record.customerSource}/${record.customerID}`],
            };
          });
          setTimeout(() => {
            this.loading = false;
          }, 1000);
        });

    this.subscriptions.add(paramSub);
  }

  playRecording(rec: VoiceMailWithCustomer, player?: HTMLAudioElement): void {
    player = new Audio(rec.url);
    player.autoplay = false;
    player.muted = false;
    player.volume = 1;

    player.onended = () => {
      this.changeSeen(rec, true);
      rec.playing = false;
    };

    player.play()
      .then(() => {
        rec.playing = true;
      })
      .catch(err => {
        this.nzMessage.error(extractErrorMessage(err, 'Datei konnte nicht abgespielt werden'));
      });
  }

  changeSeen(rec: VoiceMailRecording, seen: boolean): void {
    this.voicemailsapi.updateSeen(rec._id, seen)
      .subscribe(
        () => rec.read = seen,
        err => this.nzMessage.error(
          extractErrorMessage(err, `Aufnahmen konnte nicht als ${seen ? 'gelesen' : 'ungelesen'} markiert werden`)
        )
      );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  trackRecording(_: number, r: VoiceMailWithCustomer): string | null {
    return r._id || null;
  }
}
