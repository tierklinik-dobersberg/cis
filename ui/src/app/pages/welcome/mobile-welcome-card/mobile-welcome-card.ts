import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { injectCurrentProfile } from '@tierklinik-dobersberg/angular/behaviors';
import { GetVacationCreditsLeftResponse, UserVacationSum } from '@tierklinik-dobersberg/apis';
import { Observable, forkJoin, interval } from 'rxjs';
import { map, mergeMap, startWith } from 'rxjs/operators';
import { VoiceMailAPI } from 'src/app/api';
import { WORKTIME_SERVICE } from 'src/app/api/connect_clients';

@Component({
  selector: 'app-mobile-welcome-card',
  templateUrl: './mobile-welcome-card.html',
  styleUrls: ['./mobile-welcome-card.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileWelcomeCardComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly voicemail = inject(VoiceMailAPI);
  private readonly worktTimeService = inject(WORKTIME_SERVICE);
  private readonly cdr = inject(ChangeDetectorRef)

  protected currentUser = injectCurrentProfile();

  vacation: UserVacationSum | null = null;

  unreadMailboxes: { name: string, count: number }[] = [];

  ngOnInit() {
    this.worktTimeService
      .getVacationCreditsLeft({
        forUsers: {
          userIds: [this.currentUser()?.user.id]
        }
      })
      .catch(err => {
        return new GetVacationCreditsLeftResponse();
      })
      .then(response => {
        this.vacation = response.results.find(sum => sum.userId === this.currentUser()?.user.id)
        this.cdr.markForCheck();
      })

    const update$ = interval(10000)
      .pipe(
        startWith(-1),
        takeUntilDestroyed(this.destroyRef),
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
        this.unreadMailboxes = [];
        Object.keys(mailboxes).map(key => {
          if (mailboxes[key] === 0) {
            return;
          }
          this.unreadMailboxes.push({
            name: key,
            count: mailboxes[key],
          })
        })

        this.cdr.markForCheck();
      })
  }
}
