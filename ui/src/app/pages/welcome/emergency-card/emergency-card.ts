import { HttpErrorResponse } from "@angular/common/http";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, TrackByFunction } from "@angular/core";
import { interval, of, Subscription, throwError } from "rxjs";
import { catchError, delay, mergeMap, retryWhen, startWith } from "rxjs/operators";
import { DoctorOnDuty, ExternalAPI } from "src/app/api";

@Component({
    selector: 'app-emergency-card',
    templateUrl: './emergency-card.html',
    styleUrls: ['./emergency-card.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmergencyCardComponent implements OnInit, OnDestroy {
    private subscriptions = Subscription.EMPTY;
    onDuty: DoctorOnDuty[] = [];
    firstLoad = true;

    trackBy: TrackByFunction<DoctorOnDuty> = (_: number, item: DoctorOnDuty) => item.username;

    constructor(
        private externalapi: ExternalAPI,
        private changeDetector: ChangeDetectorRef) { }

    ngOnInit() {
        this.subscriptions = new Subscription();

        const sub = interval(20000)
            .pipe(
                startWith(0),
                mergeMap(() => this.externalapi.getDoctorsOnDuty()),
                catchError(err => {
                    // we might get a 404 if there's no roster defined for today.
                    if (err instanceof HttpErrorResponse && err.status === 404) {
                        return of([]);
                    }

                    return throwError(err);
                }),
                retryWhen(errors => errors.pipe(delay(5000))),
            )
            .subscribe({
                next: doctors => {
                    this.firstLoad = false;
                    this.onDuty = doctors || [];
                    this.changeDetector.markForCheck();
                },
            });

        this.subscriptions.add(sub);
    }

    ngOnDestroy() {
        this.subscriptions.unsubscribe();
    }
}

