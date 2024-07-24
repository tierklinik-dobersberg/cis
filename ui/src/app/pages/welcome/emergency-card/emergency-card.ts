import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, TrackByFunction, inject } from '@angular/core';
import { Code, ConnectError } from '@connectrpc/connect';
import { injectUserProfiles } from '@tierklinik-dobersberg/angular/behaviors';
import { GetOnCallResponse, OnCall } from '@tierklinik-dobersberg/apis/gen/es/tkd/pbx3cx/v1/calllog_pb';
import { Subscription, interval } from 'rxjs';
import { mergeMap, retry, startWith } from 'rxjs/operators';
import { CALL_SERVICE } from 'src/app/api/connect_clients';

@Component({
  selector: 'app-emergency-card',
  templateUrl: './emergency-card.html',
  styleUrls: ['./emergency-card.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmergencyCardComponent implements OnInit, OnDestroy {
  private readonly callService = inject(CALL_SERVICE);
  private readonly changeDetector  = inject(ChangeDetectorRef);
  protected readonly profiles = injectUserProfiles();
  private subscriptions = Subscription.EMPTY;

  onDuty: GetOnCallResponse | null = null;

  firstLoad = true;

  trackBy: TrackByFunction<OnCall> = (_: number, item: OnCall) => item.transferTarget;


  get canSetOverwrite(): boolean {
    return true;
  }

  ngOnInit(): void {
    this.subscriptions =
      interval(20000)
      .pipe(
        startWith(0),
        mergeMap(() =>
          this.callService.getOnCall({})
            .catch(err => {
              if (ConnectError.from(err).code === Code.NotFound) {
                return new GetOnCallResponse()
              }

              throw err
            })
        ),
        retry({delay: 5000}),
      )
      .subscribe({
        next: result => {
          this.firstLoad = false;
          this.onDuty = result;
          console.log("onCall", result)

          this.changeDetector.markForCheck();
        },
      });
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}

