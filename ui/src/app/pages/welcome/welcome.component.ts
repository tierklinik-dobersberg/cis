import { Component, isDevMode, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { BehaviorSubject, combineLatest, interval, Subscription } from 'rxjs';
import { delay, mergeMap, repeatWhen, retryWhen, startWith } from 'rxjs/operators';
import { DoorAPI, IdentityAPI, Permissions, Roster, RosterAPI, State, VoiceMailAPI } from 'src/app/api';
import { LayoutService } from 'src/app/services';
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
  mailboxes: string[] = [];

  get hasDoorAccess(): boolean {
    return this.identityapi.hasPermission(Permissions.DoorGet);
  }

  get hasDoctorOnDutyAccess(): boolean {
    return this.identityapi.hasPermission(Permissions.ExternalReadOnDuty);
  }

  get hasRosterAccess(): boolean {
    return this.identityapi.hasPermission(Permissions.RosterRead);
  }

  get hasTriggerAccess(): boolean {
    return this.identityapi.hasPermission(Permissions.TriggerRead)
  }

  get hasSuggestionAccess(): boolean {
    return this.identityapi.hasPermission(Permissions.SuggestionRead);
  }

  constructor(
    private header: HeaderTitleService,
    private identityapi: IdentityAPI,
    private voicemailapi: VoiceMailAPI,
    private rosterapi: RosterAPI,
    public layout: LayoutService,
  ) { }

  readonly isDevMode = isDevMode();

  private allSub = new Subscription();

  /** TEST CODE */
  currentStep = 0;
  slots = Array.from(new Array(4 * 10).keys());
  offStart = 4 * 4;
  offEnd = 4 * 6;
  startIdx: number | null = null;
  busyUser: Dummy | null = null;
  users: Dummy[] = [
    {
      name: 'Mag. Carmen Pacher',
      busyTimes: [
        [0, 4],
        [22, 28],
      ]
    },
    {
      name: 'Dr. Claudia Fürst',
      busyTimes: [
        [0, 3],
      ]
    }
  ];

  ngOnInit(): void {
    this.header.set(`Hallo ${this.identityapi.currentProfile?.fullname},`, 'Hier findest du eine Übersicht der wichtigsten Informationen.');

    this.voicemailapi.listMailboxes()
      .pipe(retryWhen(e => e.pipe(delay(10000))))
      .subscribe(mailboxes => {
        this.mailboxes = mailboxes;
      });
  }

  ngOnDestroy(): void {
    this.allSub.unsubscribe();
  }

  isBusy(idx: number, user: Dummy): boolean {
    return user.busyTimes.some(time => idx >= time[0] && idx <= time[1]);
  }

  startBusy(startIdx: number, user: Dummy, event: MouseEvent): void {
    this.startIdx = startIdx;
    this.busyUser = user;
  }

  getTime(slot: number): string {
    const hour = 8 + Math.floor(slot / 4);
    const min = (slot % 4) * 15;
    const pad = (val: number) => {
      const s = `${val}`;
      if (s.length < 2) {
        return `0${s}`;
      }
      return s;
    };

    return pad(hour) + ':' + pad(min);
  }

  endBusy(endIdx: number, user: Dummy, event: MouseEvent): void {
    if (this.startIdx === null) {
      return;
    }

    if (user !== this.busyUser) {
      this.busyUser = null;
      this.startIdx = null;
      return;
    }

    user.busyTimes.push([this.startIdx, endIdx]);
    this.startIdx = null;
    this.busyUser = null;
    this.currentStep++;
  }
}
