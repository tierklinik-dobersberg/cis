import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, TrackByFunction } from '@angular/core';
import { NzCalendarMode } from 'ng-zorro-antd/calendar';
import { Subscription } from 'rxjs';
import { delay, retryWhen } from 'rxjs/operators';
import { Day, IdentityAPI, Profile, Roster, RosterAPI } from 'src/app/api';

@Component({
  templateUrl: './roster.html',
  styleUrls: ['./roster.scss'],
})
export class RosterComponent implements OnInit, OnDestroy {
  private subscriptions = Subscription.EMPTY;

  showNoRosterAlert = false;
  editMode = false;
  saveLoading = false;
  selectedDate: Date;
  selectedDay: Day;
  selectedSlice: keyof Day;
  selectedDaySlice: { [key: string]: boolean } = {};
  usernames: string[] = [];
  userProfiles: { [key: string]: Profile } = {};

  days: {
    [key: number]: Day;
  } = {};

  constructor(
    private rosterapi: RosterAPI,
    private identityapi: IdentityAPI) {
    this.selectedDate = new Date();
  }

  ngOnInit() {
    this.subscriptions = new Subscription();

    const sub =
      this.identityapi.listUsers()
        .pipe(retryWhen(err => err.pipe(delay(2000))))
        .subscribe(
          users => {
            this.userProfiles = {};
            users.forEach(user => this.userProfiles[user.name] = user);
            this.usernames = users.map(user => user.name);
          }
        )
    this.subscriptions.add(sub);

    this.loadRoster(this.selectedDate);
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  updateCell(date: Date, what: keyof Day) {
    this.selectedDay = this.getDay(date);
    this.selectedSlice = what;

    this.selectedDaySlice = {};
    Object.keys(this.userProfiles).forEach(user => this.selectedDaySlice[user] = false);
    this.getDay(date)[what].forEach(user => this.selectedDaySlice[user] = true);
  }

  saveRoster() {
    let roster: Roster = {
      month: this.selectedDate.getMonth() + 1,
      year: this.selectedDate.getFullYear(),
      days: this.days,
    }
    this.saveLoading = true;
    this.rosterapi.create(roster)
      .subscribe(() => {
        this.saveLoading = false;
        this.editMode = false;
      }, err => {
        this.saveLoading = false;
      })
  }

  deleteRoster() {

  }

  toggleEdit() {
    if (this.editMode) {
      this.saveRoster()
      return;
    }
    this.editMode = !this.editMode;
  }

  updateSelectedStaff(staff: string[]) {
    this.selectedDay[this.selectedSlice] = staff;
  }

  loadRoster(date: Date) {
    const sub =
      this.rosterapi.forMonth(date.getFullYear(), date.getMonth() + 1)
        .subscribe(
          roster => {
            this.showNoRosterAlert = false;
            this.days = roster.days;
          },
          err => {
            if (err instanceof HttpErrorResponse && err.status === 404) {
              this.showNoRosterAlert = true;
              this.days = {};
            } else {
              console.error(err);
            }
          }
        )

    this.subscriptions.add(sub);
  }

  getDay(date: Date) {
    const day = date.getDate();
    let d = this.days[day];
    if (!d) {
      d = {
        afternoon: [],
        forenoon: [],
        emergency: [],
      }
      this.days[day] = d;
    }

    return d
  }

  onDateSelected(date: Date) {
    const changed = date.getMonth() != this.selectedDate.getMonth() || date.getFullYear() != this.selectedDate.getFullYear();
    this.selectedDate = date;

    if (changed) {
      this.onPanelChange({
        date: date,
        mode: 'month'
      })
    }
  }

  onPanelChange({ date, mode }: { date: Date, mode: NzCalendarMode }) {
    if (mode === 'year') {
      return
    }
    this.selectedDate = date;

    this.loadRoster(date);
  }
}
