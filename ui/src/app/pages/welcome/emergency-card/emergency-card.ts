import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, TrackByFunction } from '@angular/core';
import { Profile } from '@tkd/apis';
import { Subscription, interval, of, throwError } from 'rxjs';
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
  primaryOnDuty: Profile| null = null;

  trackBy: TrackByFunction<DoctorOnDuty> = (_: number, item: DoctorOnDuty) => item.userId;

  constructor(
    private externalapi: ExternalAPI,
    private userService: UserService,
    private changeDetector: ChangeDetectorRef,
  ) { }

  get canSetOverwrite(): boolean {
    return true;
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

          this.primaryOnDuty = this.userService.byId(this.onDuty[0]?.userId);
          this.changeDetector.markForCheck();
        },
      });
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}

