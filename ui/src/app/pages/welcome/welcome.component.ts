import { Component, isDevMode, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { BehaviorSubject, combineLatest, interval, Subscription } from 'rxjs';
import { delay, mergeMap, repeatWhen, retryWhen, startWith } from 'rxjs/operators';
import { DoorAPI, State } from 'src/app/api';

interface Dummy {
  name: string;
  busyTimes: [number, number][];
}

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.scss']
})
export class WelcomeComponent implements OnInit, OnDestroy {
  readonly isDevMode = isDevMode();

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

  overwriteDoor(state: 'lock' | 'unlock', duration: string) {
    this.doorapi.overwrite(state, duration)
      .subscribe((state) => {
        this.updateDoorState(state);
      }, err => console.error(err))
  }

  private allSub = new Subscription();

  constructor(private doorapi: DoorAPI) { }

  ngOnInit() {
    const sub =
      combineLatest([
        interval(5000),
        this.triggerDoorReload,
      ])
        .pipe(
          startWith(0),
          mergeMap(() => this.doorapi.state()),
          retryWhen(err => err.pipe(delay(5000))),
        )
        .subscribe(state => {
          this.updateDoorState(state);
        })

    this.allSub.add(sub);
  }

  private updateDoorState(state: State) {
    console.log(state);
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
    this.doorapi.reset()
      .subscribe(state => {
        this.updateDoorState(state);
        this.triggerDoorReload.next();
      }, err => console.log(err))
  }

  ngOnDestroy() {
    this.allSub.unsubscribe();
  }


  /** TEST CODE */
  currentStep = 0;
  slots = Array.from(new Array(4 * 10).keys());
  offStart = 4 * 4;
  offEnd = 4 * 6;
  startIdx: number | null = null;
  busyUser: Dummy | null = null;
  users: Dummy[] = [
    {
      name: "Mag. Carmen Pacher",
      busyTimes: [
        [0, 4],
        [22, 28],
      ]
    },
    {
      name: "Dr. Claudia Fürst",
      busyTimes: [
        [0, 3],
      ]
    }
  ]

  isBusy(idx: number, user: Dummy) {
    return user.busyTimes.some(time => idx >= time[0] && idx <= time[1]);
  }

  startBusy(startIdx: number, user: Dummy, event: MouseEvent) {
    this.startIdx = startIdx;
    this.busyUser = user;
  }

  getTime(slot: number) {
    const hour = 8 + Math.floor(slot / 4);
    const min = (slot % 4) * 15;
    const pad = (val: number) => {
      let s = `${val}`;
      if (s.length < 2) {
        return `0${s}`
      }
      return s
    }

    return pad(hour) + ":" + pad(min)
  }

  endBusy(endIdx: number, user: Dummy, event: MouseEvent) {
    if (this.startIdx === null) {
      return;
    }

    if (user !== this.busyUser) {
      this.busyUser = null;
      this.startIdx = null;
      return
    }

    user.busyTimes.push([this.startIdx, endIdx]);
    this.startIdx = null;
    this.busyUser = null;
    this.currentStep++;
  }
}
