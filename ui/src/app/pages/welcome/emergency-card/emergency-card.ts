import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, TrackByFunction } from '@angular/core';
import { forkJoin, interval, of, Subscription, throwError } from 'rxjs';
import { catchError, delay, mergeMap, retryWhen, startWith } from 'rxjs/operators';
import {
  Day,
  DoctorOnDuty,
  DoctorOnDutyResponse,
  ExternalAPI,
  IdentityAPI,
  Permissions,
  ProfileWithAvatar, Roster,
  RosterAPI,
  UserService
} from 'src/app/api';

@Component({
  selector: 'app-emergency-card',
  templateUrl: './emergency-card.html',
  styleUrls: ['./emergency-card.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmergencyCardComponent implements OnInit, OnDestroy {
  private subscriptions = Subscription.EMPTY;

  onDuty: DoctorOnDuty[] = [];
  isOverwritten = false;
  onDutyUntil: Date | null = null;
  firstLoad = true;
  primaryOnDuty: ProfileWithAvatar | null = null;
  shiftKind: string = 'Bereitschaftsdienst';
  rosterDay: Day | null = null;


  trackBy: TrackByFunction<DoctorOnDuty> = (_: number, item: DoctorOnDuty) => item.username;

  constructor(
    private externalapi: ExternalAPI,
    private identityapi: IdentityAPI,
    private userService: UserService,
    private rosterapi: RosterAPI,
    private changeDetector: ChangeDetectorRef,
  ) { }

  get canSetOverwrite(): boolean {
    return this.identityapi.hasPermission(Permissions.RosterSetOverwrite);
  }

  ngOnInit(): void {
    this.subscriptions =
      interval(20000)
      .pipe(
        startWith(0),
        mergeMap(() => forkJoin({
          onDuty: this.externalapi.getDoctorsOnDuty()
            .pipe(
              catchError(err => {
                // we might get a 404 if there's no roster defined for today.
                if (err instanceof HttpErrorResponse && err.status === 404) {
                  return of({
                    doctors: [],
                    until: null,
                    isOverwrite: false,
                  } as DoctorOnDutyResponse<any>);
                }

                return throwError(err);
              }),
            ),
          roster: this.rosterapi.forMonth()
            .pipe(
              catchError(err => {
                if (err instanceof HttpErrorResponse && err.status === 404) {
                  return of(null as Roster);
                }
                return throwError(err);
              })
            )
        })),
        retryWhen(errors => errors.pipe(delay(5000))),
      )
      .subscribe({
        next: result => {
          this.firstLoad = false;
          this.onDuty = result.onDuty.doctors || [];
          this.onDutyUntil = result.onDuty.until;
          this.isOverwritten = result.onDuty.isOverwrite;

          if (result.onDuty.isOverwrite) {
            this.shiftKind = 'Bereitschaftsdienst (überschrieben)'
          } else
            if (result.onDuty.isDayShift && result.onDuty.isNightShift) {
              this.shiftKind = 'Bereitschaft (ganzer Tag)';
            } else if (result.onDuty.isDayShift) {
              this.shiftKind = 'Tag-Bereitschaft';
            } else if (result.onDuty.isNightShift) {
              this.shiftKind = 'Nacht-Bereitschaft';
            } else {
              this.shiftKind = 'Bereitschaftsdienst (unbekannt)'
            }

          this.rosterDay = null;
          if (!!result.roster) {
            this.rosterDay = result.roster.days[(new Date().getDate())];
          }

          this.primaryOnDuty = this.userService.byName(this.onDuty[0]?.username);
          this.changeDetector.markForCheck();
        },
      });
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}

