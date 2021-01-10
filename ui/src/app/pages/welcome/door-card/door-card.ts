import { Component, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { BehaviorSubject, Subscription, combineLatest, interval } from 'rxjs';
import { startWith, mergeMap, retryWhen, delay } from 'rxjs/operators';
import { DoorAPI, State } from 'src/app/api';

@Component({
  selector: 'app-door-card',
  templateUrl: './door-card.html',
  styleUrls: ['./door-card.scss']
})
export class DoorCardComponent implements OnInit, OnDestroy {
  constructor(private doorapi: DoorAPI) { }

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
    this.doorapi.reset()
      .subscribe(state => {
        this.updateDoorState(state);
        this.triggerDoorReload.next();
      }, err => console.log(err))
  }

  ngOnDestroy() {
    this.allSub.unsubscribe();
  }
}
