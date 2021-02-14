import { Component, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { BehaviorSubject, Subscription, combineLatest, interval } from 'rxjs';
import { startWith, mergeMap, retryWhen, delay, takeUntil, takeWhile, tap } from 'rxjs/operators';
import { DoorAPI, IdentityAPI, Permission, State } from 'src/app/api';

@Component({
  selector: 'app-door-card',
  templateUrl: './door-card.html',
  styleUrls: ['./door-card.scss']
})
export class DoorCardComponent implements OnInit, OnDestroy {

  doorState: State;
  doorActions: TemplateRef<any>[] = [];
  stateUntilDay: string = '';
  stateUntilTime: string = '';
  private triggerDoorReload = new BehaviorSubject<void>(undefined);

  @ViewChild('openAction', { read: TemplateRef, static: true })
  openAction: TemplateRef<any>;

  @ViewChild('unlockAction', { read: TemplateRef, static: true })
  unlockAction: TemplateRef<any>;

  @ViewChild('lockAction', { read: TemplateRef, static: true })
  lockAction: TemplateRef<any>;

  @ViewChild('resetAction', { read: TemplateRef, static: true })
  resetAction: TemplateRef<any>;

  get hasWriteAccess() {
    return this.identityapi.hasPermission(Permission.DoorSet)
  }

  constructor(
    private identityapi: IdentityAPI,
    private doorapi: DoorAPI,
    private nzMessageService: NzMessageService,
  ) { }

  overwriteDoor(state: 'lock' | 'unlock', duration: string) {
    this.doorapi.overwrite(state, duration)
      .subscribe((state) => {
        this.updateDoorState(state);
      }, err => console.error(err))
  }

  private allSub = new Subscription();

  ngOnInit() {
    const sub =
      combineLatest([
        interval(10000),
        this.triggerDoorReload,
      ])
        .pipe(
          startWith(0),
          mergeMap(() => this.doorapi.state()),
          retryWhen(err => err.pipe(delay(10000))),
        )
        .subscribe(state => {
          this.updateDoorState(state);
        })

    this.allSub.add(sub);
  }

  private updateDoorState(state: State) {
    this.doorState = state;

    const now = new Date();

    this.doorActions = [
      this.lockAction,
      this.resetAction,
    ]
    if (this.doorState.state === 'locked') {
      this.doorActions = [
        this.unlockAction,
        this.openAction,
        this.resetAction,
      ]
    }

    this.stateUntilDay = '';
    this.stateUntilTime = state.until.toLocaleTimeString();
    if (now.toDateString() != state.until.toDateString()) {
      const days = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
      this.stateUntilDay = days[state.until.getDay()] + " ";
    }
  }

  resetDoor() {
    const resetMessageID = this.nzMessageService.loading("Tür wird zurückgesetzt", {
      nzDuration: 0,
    }).messageId;

    let resetStarted = false;
    this.doorapi.reset()
      .pipe(
        mergeMap(state => interval(1000)),
        mergeMap(() => this.doorapi.state()),
        tap(state => {
          if (state.resetInProgress) {
            resetStarted = true
          }
        }),
        takeWhile(state => !resetStarted || state.resetInProgress)
      )
      .subscribe(
        state => this.updateDoorState(state),
        err => console.error(err),
        () => {
          this.nzMessageService.remove(resetMessageID);
          this.nzMessageService.success("Tür wurde zurückgesetzt");
        }
      )
  }

  ngOnDestroy() {
    this.allSub.unsubscribe();
  }
}
