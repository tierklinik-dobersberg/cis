import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, QueryList, TrackByFunction, ViewChildren } from '@angular/core';
import { NzCalendarMode } from 'ng-zorro-antd/calendar';
import { NzDropDownDirective } from 'ng-zorro-antd/dropdown';
import { Subscription } from 'rxjs';
import { delay, mergeMap, retryWhen } from 'rxjs/operators';
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
  menuVisible = false;

  selectedDay: Day = {
    afternoon: [],
    forenoon: [],
    emergency: [],
  };

  usernames: string[] = [];
  userProfiles: { [key: string]: Profile } = {};

  dropdownVisible: { [key: string]: boolean } = {};

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

  updateCell(date: Date) {
    this.selectedDay = this.getDay(date);
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

  get isDropDownVisible(): boolean {
    if (Object.keys(this.dropdownVisible).some(key => !!this.dropdownVisible[key])) {
      return true
    }

    return false;
  }

  getVisibleProp(date: string) {
    if (this.dropdownVisible[date] === undefined) {
      this.dropdownVisible[date] = false;
    }

    return this.dropdownVisible;
  }

  deleteRoster() {
    this.rosterapi.delete(this.selectedDate.getFullYear(), this.selectedDate.getMonth() + 1)
      .subscribe(() => this.loadRoster(), err => console.error(err))
  }

  toggleEdit() {
    if (this.editMode) {
      this.saveRoster()
      return;
    }
    this.editMode = !this.editMode;
  }

  loadRoster(date: Date = this.selectedDate) {
    const sub =
      this.rosterapi.forMonth(date.getFullYear(), date.getMonth() + 1)
        .subscribe(
          roster => {
            this.dropdownVisible = {};
            this.showNoRosterAlert = false;
            this.days = roster.days;
            this.editMode = false;
            this.saveLoading = false;
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

  closeDropdown() {
    Object.keys(this.dropdownVisible).forEach(key => this.dropdownVisible[key] = false);
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