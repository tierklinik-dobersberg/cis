import { Component, isDevMode, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { BehaviorSubject, combineLatest, interval, Subscription } from 'rxjs';
import { delay, mergeMap, repeatWhen, retryWhen, startWith } from 'rxjs/operators';
import { DoorAPI, IdentityAPI, Roster, RosterAPI, State } from 'src/app/api';
import { HeaderTitleService } from 'src/app/shared/header-title';

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

  private allSub = new Subscription();

  constructor(
    private header: HeaderTitleService,
    private identityapi: IdentityAPI,
    private rosterapi: RosterAPI
  ) { }

  ngOnInit() {
    this.header.set('Dashboard')
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
