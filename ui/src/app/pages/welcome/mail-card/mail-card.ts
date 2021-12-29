import { OnInit } from '@angular/core';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy } from '@angular/core';
import { interval, Subscription } from 'rxjs';
import { delay, mergeMap, retryWhen, startWith } from 'rxjs/operators';
import { VoiceMailAPI } from 'src/app/api';

@Component({
  selector: 'app-voicemail-card',
  templateUrl: './mail-card.html',
  styleUrls: ['./mail-card.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoiceMailCardComponent implements OnInit, OnDestroy {
  private subscriptions = Subscription.EMPTY;

  @Input()
  mailboxName: string;

  /** The number of unread voicemails in this mailbox. */
  unreadCount = 0;

  constructor(
    private voicemail: VoiceMailAPI,
    private changeDetector: ChangeDetectorRef,
  ) { }

  ngOnInit(): void {
    this.subscriptions = interval(10000)
      .pipe(
        startWith(-1),
        mergeMap(() => this.voicemail.search({
          name: this.mailboxName,
          seen: false,
        })),
        retryWhen(e => e.pipe(delay(10000))),
      )
      .subscribe(voicemails => {
        this.unreadCount = (voicemails || []).length;
        this.changeDetector.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
