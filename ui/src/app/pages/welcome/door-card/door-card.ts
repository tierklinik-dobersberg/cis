import {
  Component,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { TkdAccountService, Permissions } from '@tkd/api';
import { NzMessageService } from 'ng-zorro-antd/message';
import { BehaviorSubject, combineLatest, interval, Subscription } from 'rxjs';
import {
  delay,
  mergeMap,
  retryWhen,
  startWith,
  takeWhile,
  tap,
} from 'rxjs/operators';
import { DoorAPI, IdentityAPI, State } from 'src/app/api';
import { extractErrorMessage } from 'src/app/utils';

@Component({
  selector: 'app-door-card',
  templateUrl: './door-card.html',
  styleUrls: ['./door-card.scss'],
})
export class DoorCardComponent implements OnInit, OnDestroy {
  get hasWriteAccess(): boolean {
    return this.account.hasPermission(Permissions.DoorSet);
  }

  constructor(
    private account: TkdAccountService,
    private doorapi: DoorAPI,
    private nzMessageService: NzMessageService
  ) {}

  clock: Date = new Date();
  doorState: State;
  doorActions: TemplateRef<any>[] = [];
  stateUntilDay = '';
  stateUntilTime = '';
  private triggerDoorReload = new BehaviorSubject<void>(undefined);

  @ViewChild('openAction', { read: TemplateRef, static: true })
  openAction: TemplateRef<any>;

  @ViewChild('unlockAction', { read: TemplateRef, static: true })
  unlockAction: TemplateRef<any>;

  @ViewChild('lockAction', { read: TemplateRef, static: true })
  lockAction: TemplateRef<any>;

  @ViewChild('resetAction', { read: TemplateRef, static: true })
  resetAction: TemplateRef<any>;

  private allSub = new Subscription();

  overwriteDoor(state: 'lock' | 'unlock' | 'open', duration?: string): void {
    const messageId = this.nzMessageService.loading("Befehl wird gesendet ...");
    this.doorapi.overwrite(state as any, duration).subscribe(
      (updatedState) => {
        this.nzMessageService.remove(messageId.messageId);
        if (!!updatedState) {
          this.updateDoorState(updatedState);
        } else {
          this.nzMessageService.success('Eingangstür geöffnet');
        }
      },
      (err) => {
        this.nzMessageService.remove(messageId.messageId);
        this.nzMessageService.error(extractErrorMessage(err));
      }
    );
  }

  ngOnInit(): void {
    const sub = combineLatest([interval(10000), this.triggerDoorReload])
      .pipe(
        startWith(0),
        mergeMap(() => this.doorapi.state()),
        retryWhen((err) => err.pipe(delay(10000)))
      )
      .subscribe((state) => {
        this.clock = new Date();
        this.updateDoorState(state);
      });
    this.allSub.add(sub);
  }

  private updateDoorState(state: State): void {
    this.doorState = state;

    const now = new Date();

    this.doorActions = [this.lockAction, this.resetAction];
    if (this.doorState.state === 'locked') {
      this.doorActions = [this.unlockAction, this.resetAction];
    }

    this.stateUntilDay = '';
    this.stateUntilTime = state.until.toLocaleTimeString();
    if (now.toDateString() !== state.until.toDateString()) {
      const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
      this.stateUntilDay = days[state.until.getDay()] + ' ';
    }
  }

  resetDoor(): void {
    const resetMessageID = this.nzMessageService.loading(
      'Tür wird zurückgesetzt',
      {
        nzDuration: 0,
      }
    ).messageId;

    let resetStarted = false;
    this.doorapi
      .reset()
      .pipe(
        mergeMap((state) => interval(1000)),
        mergeMap(() => this.doorapi.state()),
        tap((state) => {
          if (state.resetInProgress) {
            resetStarted = true;
          }
        }),
        takeWhile((state) => !resetStarted || state.resetInProgress)
      )
      .subscribe(
        (state) => this.updateDoorState(state),
        (err) => console.error(err),
        () => {
          this.nzMessageService.remove(resetMessageID);
          this.nzMessageService.success('Tür wurde zurückgesetzt');
        }
      );
  }

  ngOnDestroy(): void {
    this.allSub.unsubscribe();
  }
}
