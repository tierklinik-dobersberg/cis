import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, TrackByFunction } from '@angular/core';
import { Permissions, ProfileWithAvatar, TkdAccountService } from '@tkd/api';
import { interval, of, Subscription, throwError } from 'rxjs';
import { catchError, delay, mergeMap, retryWhen, startWith } from 'rxjs/operators';
import {
  DoctorOnDuty,
  DoctorOnDutyResponse,
  ExternalAPI, UserService
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

  trackBy: TrackByFunction<DoctorOnDuty> = (_: number, item: DoctorOnDuty) => item.username;

  constructor(
    private externalapi: ExternalAPI,
    private account: TkdAccountService,
    private userService: UserService,
    private changeDetector: ChangeDetectorRef,
  ) { }

  get canSetOverwrite(): boolean {
    return this.account.hasPermission(Permissions.RosterSetOverwrite);
  }

  ngOnInit(): void {
    this.subscriptions =
      interval(20000)
      .pipe(
        startWith(0),
        mergeMap(() => this.externalapi.getDoctorsOnDuty()
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
        ),
        retryWhen(errors => errors.pipe(delay(5000))),
      )
      .subscribe({
        next: result => {
          this.firstLoad = false;
          this.onDuty = result.doctors || [];
          this.onDutyUntil = result.until;
          this.isOverwritten = result.isOverwrite;

          if (result.isOverwrite) {
            this.shiftKind = 'Bereitschaftsdienst (überschrieben)'
          } else
            if (result.isDayShift && result.isNightShift) {
              this.shiftKind = 'Bereitschaft (ganzer Tag)';
            } else if (result.isDayShift) {
              this.shiftKind = 'Tag-Bereitschaft';
            } else if (result.isNightShift) {
              this.shiftKind = 'Nacht-Bereitschaft';
            } else {
              this.shiftKind = 'Bereitschaftsdienst (unbekannt)'
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

