import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { forkJoin, interval, Observable, Subject } from 'rxjs';
import { map, mergeMap, startWith, takeUntil } from 'rxjs/operators';
import { IdentityAPI, ProfileWithAvatar, UserService, VoiceMailAPI } from 'src/app/api';

@Component({
  selector: 'app-mobile-welcome-card',
  templateUrl: './mobile-welcome-card.html',
  styleUrls: ['./mobile-welcome-card.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileWelcomeCardComponent implements OnInit, OnDestroy {
  user$: Observable<ProfileWithAvatar> | null;

  private destroy$ = new Subject<void>();

  unreadMailboxes: { name: string, count: number }[] = [
    { name: "Visiten Anmeldungen", count: 5 },
  ];

  constructor(
    private identityAPI: IdentityAPI,
    private voicemail: VoiceMailAPI,
  ) { }

  ngOnInit() {
    this.user$ = this.identityAPI.profile()
      .pipe(takeUntil(this.destroy$));

    const update$ = interval(10000)
      .pipe(
        startWith(-1),
        takeUntil(this.destroy$),
      );

    update$.pipe(
      mergeMap(() => this.voicemail.listMailboxes()),
      mergeMap(mailboxes => {
        let fetch: { [key: string]: Observable<number> } = {};
        mailboxes.forEach(mb => {
          fetch[mb] = this.voicemail.search({
            name: mb,
            seen: false,
          }).pipe(map(result => result?.length || 0))
        })
        return forkJoin(fetch);
      }),
    )
      .subscribe(mailboxes => {
        //this.unreadMailboxes = [];
        Object.keys(mailboxes).map(key => {
          if (mailboxes[key] === 0) {
            return;
          }
          this.unreadMailboxes.push({
            name: key,
            count: mailboxes[key],
          })
        })
      })
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
