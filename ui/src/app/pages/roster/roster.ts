import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { StorageMap } from '@ngx-pwa/local-storage';
import { NzCalendarMode } from 'ng-zorro-antd/calendar';
import { NzMessageService } from 'ng-zorro-antd/message';
import { Observable, Subject, Subscription, throwError } from 'rxjs';
import { catchError, debounceTime, delay, map, retryWhen } from 'rxjs/operators';
import { Comment as BaseComment, CommentAPI, Day, Holiday, HolidayAPI, IdentityAPI, Permission, ProfileWithAvatar, Roster, RosterAPI } from 'src/app/api';
import { LayoutService } from 'src/app/services';
import { HeaderTitleService } from 'src/app/shared/header-title';
import { extractErrorMessage } from 'src/app/utils';

interface Comment extends BaseComment {
  date: Date;
  edited?: boolean;
  profile: ProfileWithAvatar;
}

@Component({
  templateUrl: './roster.html',
  styleUrls: ['./roster.scss'],
})
export class RosterComponent implements OnInit, OnDestroy {
  private subscriptions = Subscription.EMPTY;

  readonly weekdays = [
    "Sonntag",
    "Montag",
    "Dienstag",
    "Mittwoch",
    "Donnerstag",
    "Freitag",
    "Samstag"
  ];

  /** Whether or not the roster should be displayed as readonly  */
  readonly = false;

  /** Whether or not we need to show the no-roster alert */
  showNoRosterAlert = false;

  /** Whether or not we are currently editing the roster */
  editMode = false;

  /** Whether or not a save-operation is currently in progress */
  saveLoading = false;

  /** The currently selected date (month/year) for which we show the roster */
  selectedDate: Date;

  /** Dates holds a list of dates for the given month. Only used on mobile. */
  dates: Date[] = [];

  /** The currently selected day for the day-edit-menu */
  selectedDay: Day = {
    afternoon: [],
    forenoon: [],
    emergency: [],
  };

  /** All available user names */
  usernames: string[] = [];

  /** All available user profiles */
  userProfiles: { [key: string]: ProfileWithAvatar } = {};

  /** Whether or not the day-edit-menu is visible or not. Index by day. */
  dropdownVisible: { [key: string]: boolean } = {};

  /** The different days of the roster */
  days: {
    [key: number]: Day;
  } = {};

  /** All available holidays index by key YYYY/MM/DD */
  holidays: {
    [key: number]: Holiday;
  } = {};

  /** The current user that should be highlighted */
  highlightUser: string = '';

  /** The user that should be highlighted if not overwritten by highlightUser */
  defaultHightlightUser: string = '';

  highlightUserSubject = new Subject<string>();

  /** Whether or not the comment box is shown */
  showComments = false;

  /** All comments for the roster. */
  comments: Comment[] = [];

  /** two-way binded value for the create-comment textarea */
  newComment = '';

  constructor(
    private header: HeaderTitleService,
    private rosterapi: RosterAPI,
    private holidayapi: HolidayAPI,
    private identityapi: IdentityAPI,
    private commentapi: CommentAPI,
    private messageService: NzMessageService,
    private storage: StorageMap,
    private route: ActivatedRoute,
    public layout: LayoutService,
  ) {
    this.setSelectedDate(new Date());
  }

  /** canEditRoster is true if the current user has permission to edit the roster. */
  get canEditRoster() {
    return this.identityapi.hasPermission(Permission.RosterWrite);
  }

  setSelectedDate(d: Date) {
    this.selectedDate = d;
    this.dates = [];
    const month = d.getMonth();
    const year = d.getFullYear();
    const daysInMonth = this.daysInMonth(month, year)
    console.log(daysInMonth);

    for (let i = 1; i <= daysInMonth; i++) {
      this.dates.push(
        new Date(year, month, i)
      )
    }
  }

  ngOnInit() {
    this.subscriptions = new Subscription();

    // Load all users and keep retrying until we got them.
    const sub =
      this.identityapi.listUsers()
        .pipe(retryWhen(err => err.pipe(delay(2000))))
        .subscribe(
          users => {
            this.userProfiles = {};
            users.forEach(user => this.userProfiles[user.name] = user);
            this.usernames = users.map(user => user.name);

            // finally, load the current roster
            this.loadRoster(this.selectedDate);
          }
        )
    this.subscriptions.add(sub);

    // The roster is always readonly on tablet-portrait and down
    const layoutSub = this.layout.change.subscribe(() => {
      // TODO(ppacher): once we have proper permission checks
      // make sure to update this part as well.
      if (this.layout.isPhone || (this.layout.isTabletPortraitUp && !this.layout.isTabletLandscapeUp)) {
        this.readonly = true;
      } else {
        this.readonly = false;
      }

      if (this.layout.isPhone && !!window.requestAnimationFrame) {
        window.requestAnimationFrame(() => {
          const id = this.selectedDate.toDateString();
          document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
        });
      }
    });
    this.subscriptions.add(layoutSub);

    // Subscribe to changes to the "show" query parameter.
    const routeSub = this.route.queryParamMap
      .subscribe(params => {
        this.defaultHightlightUser = params.get('show');
        this.highlightUser = this.defaultHightlightUser;
      });
    this.subscriptions.add(routeSub);

    // Subscribe to "on-hover" events pushed to hightlighUserSubject
    const highlightSub = this.highlightUserSubject
      .pipe(debounceTime(200))
      .subscribe(user => {
        this.highlightUser = user || this.defaultHightlightUser;
      })
    this.subscriptions.add(highlightSub);
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  /** Callback when the user clicks on a roster date- */
  selectRosterDay(date: Date) {
    this.selectedDay = this.getDay(date);
  }

  shouldHighlightDay(date: Date): boolean {
    const day = this.getDay(date);
    if (day.forenoon.some(user => user === this.highlightUser)) {
      return true;
    }
    if (day.afternoon.some(user => user === this.highlightUser)) {
      return true;
    }
    if (day.emergency.some(user => user === this.highlightUser)) {
      return true;
    }
    return false;
  }

  nextMonth() {
    this.onPanelChange({
      date: new Date(this.selectedDate.getFullYear(), this.selectedDate.getMonth() + 1, 1),
      mode: 'month',
    })
  }

  prevMonth() {
    this.onPanelChange({
      date: new Date(this.selectedDate.getFullYear(), this.selectedDate.getMonth() - 1, 1),
      mode: 'month',
    })
  }

  today() {
    this.onPanelChange({
      date: new Date(),
      mode: 'month',
    }, true)
  }

  createComment() {
    const year = this.selectedDate.getFullYear();
    const month = this.selectedDate.getMonth() + 1;
    this.commentapi.create(`roster:${year}-${month}`, this.newComment)
      .subscribe(
        () => {
          this.newComment = '';
          this.loadComments();
        },
        err => {
          this.messageService.error(extractErrorMessage(err, 'Kommentieren fehlgeschlagen'))
        }
      )
  }

  /**
   * Save the current roster.
   */
  saveRoster() {
    let roster: Roster = {
      month: this.selectedDate.getMonth() + 1,
      year: this.selectedDate.getFullYear(),
      days: this.days,
    }
    this.saveLoading = true;
    this.rosterapi.create(roster)
      .subscribe(() => {
        this.showNoRosterAlert = false;
        this.saveLoading = false;
        this.editMode = false;
        this.messageService.success("Dienstplan gespeichert")

        // finally, discard any unsaved changes and reload
        this.discardChanges();
      }, err => {
        this.saveLoading = false;
        this.messageService.error(extractErrorMessage(err, 'Dienstplan konnte nicht gespeicher werden'))
      })
  }

  /** Whether or not the edit-day-menu is currently visible.  */
  get isDropDownVisible(): boolean {
    if (Object.keys(this.dropdownVisible).some(key => !!this.dropdownVisible[key])) {
      return true
    }

    return false;
  }

  /**
   * Returns (and maybe creates) the boolean that is used to
   * trigger the day-edit-menu for the specific roster date.
   */
  getVisibleProp(date: string) {
    if (this.dropdownVisible[date] === undefined) {
      this.dropdownVisible[date] = false;
    }

    return this.dropdownVisible;
  }

  /**
   * Delete the currenlty displayed roster.
   */
  deleteRoster() {
    this.rosterapi.delete(this.selectedDate.getFullYear(), this.selectedDate.getMonth() + 1)
      .subscribe(() => {
        this.loadRoster();
        this.messageService.success("Dienstplan gelöscht.");
      }, err => console.error(err))
  }

  /**
   * Toggle edit mode. If we're currenlty editing the roster
   * the roster will be saved and edit mode will stopped.
   */
  toggleEdit() {
    if (this.readonly) {
      return;
    }

    if (this.editMode) {
      this.saveRoster()
      return;
    }
    this.editMode = !this.editMode;
  }

  discardChanges() {
    const key = `roster/${this.selectedDate.getFullYear()}/${this.selectedDate.getMonth() + 1}`;
    this.storage.delete(key)
      .subscribe(() => this.loadRoster());
  }

  toggleComments() {
    this.showComments = !this.showComments;
  }

  /**
   * Loads the roster for date.
   */
  loadRoster(date: Date = this.selectedDate, scrollTo = false) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    this.header.set(`Dienstplan:  ${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`)
    const sub =
      this.rosterapi.forMonth(date.getFullYear(), date.getMonth() + 1)
        .pipe(
          map(roster => [roster, true] as [Roster, boolean]),
          catchError(err => {
            if (err instanceof HttpErrorResponse && err.status === 404) {
              // if there's no roster for this month check if we have an
              // "in-progress" version stored in the localStorage.
              const key = `roster/${date.getFullYear()}/${date.getMonth() + 1}`;
              return this.storage.get(key)
                .pipe(
                  map(r => {
                    // if there's no roster for year/month in local-storage
                    // re-throw the orignal error.
                    if (!r) {
                      throw err;
                    }

                    return [r, false];
                  })
                ) as Observable<[Roster, boolean]>
            }

            return throwError(err);
          })
        )
        .subscribe(
          ([roster, isSaved]) => {
            this.dropdownVisible = {};
            this.showNoRosterAlert = false;
            this.days = roster.days;

            this.editMode = !isSaved;
            this.saveLoading = false;

            if (scrollTo) {
              if (this.layout.isPhone && !!window.requestAnimationFrame) {
                window.requestAnimationFrame(() => {
                  const id = this.selectedDate.toDateString();
                  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
                });
              }
            }
          },
          err => {
            this.editMode = false;
            this.saveLoading = false;

            if (err instanceof HttpErrorResponse && err.status === 404) {
              this.showNoRosterAlert = true;
              this.days = {};
            } else {
              console.error(err);
            }
          }
        )
    this.subscriptions.add(sub);

    const sub2 =
      this.holidayapi.forMonth(year, month)
        .subscribe(holidays => {
          holidays.forEach(day => {
            this.holidays[new Date(day.date).toDateString()] = day;
          });
        })
    this.subscriptions.add(sub2);

    this.loadComments(date);
  }

  loadComments(date = this.selectedDate) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    const sub =
      this.commentapi.list(`roster:${year}-${month}`, true, true)
        .subscribe(
          comments => {
            console.log(comments);
            this.comments = comments
              .map(c => {
                let date = new Date(c.createdAt);
                let edited = false;
                if (c.createdAt !== c.updatedAt) {
                  edited = true;
                  date = new Date(c.updatedAt);
                }

                return {
                  ...c,
                  date: date,
                  edited: edited,
                  profile: this.userProfiles[c.user],
                }
              })
              .sort((a, b) => new Date(a.createdAt).valueOf() - new Date(b.createdAt).valueOf())
          },
          err => {
            console.error(err);
          }
        )
    this.subscriptions.add(sub);
  }

  /** Closes all edit-day-menu dropdowns */
  closeDropdown() {
    Object.keys(this.dropdownVisible).forEach(key => this.dropdownVisible[key] = false);
  }

  /**
   * Callback when the roster got modified.
   */
  rosterChanged() {
    let roster: Roster = {
      month: this.selectedDate.getMonth() + 1,
      year: this.selectedDate.getFullYear(),
      days: this.days,
    }

    this.storage.set(`roster/${roster.year}/${roster.month}`, roster)
      .subscribe();
  }

  /**
   * Returns the Day object for date. If it does not yet exist
   * it is created and stored in the days object.
   *
   * @param date The date in question
   */
  getDay(date: Date) {
    // return an empty day if the request if for some day
    // out of the currently selected month
    // TODO(ppacher): fetch that month as well ....
    if (this.selectedDate.getMonth() != date.getMonth()) {
      return {
        afternoon: [],
        forenoon: [],
        emergency: [],
      }
    }

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

  /**
   * Callback when the user selected a day in the roster
   */
  onDateSelected(date: Date) {
    const changed = date.getMonth() != this.selectedDate.getMonth() || date.getFullYear() != this.selectedDate.getFullYear();
    this.setSelectedDate(date);

    if (changed) {
      this.onPanelChange({
        date: date,
        mode: 'month'
      })
    }
  }

  /**
   * Callback for changes in the date displayed.
   *
   * @param param0 The event emitted
   */
  onPanelChange({ date, mode }: { date: Date, mode: NzCalendarMode }, scrollTo = false) {
    if (mode === 'year') {
      return
    }
    this.setSelectedDate(date);

    this.loadRoster(date, scrollTo);
  }

  /** Returns the number of days in month/year */
  daysInMonth(month: number, year: number): number {
    return new Date(year, month + 1, 0).getDate();
  }
}
