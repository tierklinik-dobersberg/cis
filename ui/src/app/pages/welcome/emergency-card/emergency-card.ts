import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, TrackByFunction, inject } from '@angular/core';
import { Code, ConnectError } from '@bufbuild/connect';
import { GetOnCallResponse, OnCall } from '@tkd/apis/gen/es/tkd/pbx3cx/v1/calllog_pb';
import { Subscription, interval } from 'rxjs';
import { delay, mergeMap, retryWhen, startWith } from 'rxjs/operators';
import {
  UserService
} from 'src/app/api';
import { CALL_SERVICE } from 'src/app/api/connect_clients';

@Component({
  selector: 'app-emergency-card',
  templateUrl: './emergency-card.html',
  styleUrls: ['./emergency-card.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmergencyCardComponent implements OnInit, OnDestroy {
  private subscriptions = Subscription.EMPTY;
  private callService = inject(CALL_SERVICE);

  onDuty: GetOnCallResponse | null = null;

  firstLoad = true;

  trackBy: TrackByFunction<OnCall> = (_: number, item: OnCall) => item.transferTarget;

  constructor(
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
        mergeMap(() =>
          this.callService.getOnCall({})
            .catch(err => {
              if (ConnectError.from(err).code === Code.NotFound) {
                return new GetOnCallResponse()
              }

              throw err
            })
        ),
        retryWhen(errors => errors.pipe(delay(5000))),
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

