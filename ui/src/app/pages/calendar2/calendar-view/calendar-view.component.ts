import { CommonModule, DOCUMENT } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, Renderer2, ViewChild, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { PlainMessage, Timestamp } from '@bufbuild/protobuf';
import { CALENDAR_SERVICE, ROSTER_SERVICE } from "@tierklinik-dobersberg/angular/connect";
import { UserColorPipe, UserContrastColorPipe } from "@tierklinik-dobersberg/angular/pipes";
import { CalendarEvent, Profile, WorkShift } from "@tierklinik-dobersberg/apis";
import { NzMessageModule, NzMessageService } from "ng-zorro-antd/message";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { Observable, filter, forkJoin, map, of, switchMap, tap } from "rxjs";
import { ConfigAPI, UserService } from "src/app/api";
import { LayoutService } from "src/app/services";
import { TkdDateInputModule } from "src/app/shared/date-input";
import { SharedModule } from "src/app/shared/shared.module";
import { toDateString } from "src/app/utils";
import { Calendar, CalendarMouseEvent, IsSameDayPipe, TimeFormatPipe, Timed, TkdCalendarEventCellTemplateDirective, TkdCalendarHeaderCellTemplateDirective, TkdDayViewComponent } from "../day-view";
import { getSeconds } from "../day-view/sort.pipe";
import { HlmButtonModule } from "@tierklinik-dobersberg/angular/button";

type CalEvent = Timed & PlainMessage<CalendarEvent> & {
  isShiftType?: boolean;
};

type LocalCalendar = Calendar<CalEvent> & {
  user?: Profile;
  display?: boolean;
};

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'tkd-calendar-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './calendar-view.component.html',
  standalone: true,
  imports: [
    CommonModule,
    SharedModule,
    TkdDayViewComponent,
    TkdCalendarHeaderCellTemplateDirective,
    TkdCalendarEventCellTemplateDirective,
    UserColorPipe,
    UserContrastColorPipe,
    TimeFormatPipe,
    FormsModule,
    TkdDateInputModule,
    NzToolTipModule,
    NzMessageModule,
    IsSameDayPipe,
    HlmButtonModule
],
  styles: [
    `
        .event-container {
          container-type: size;
        }

        @container (max-height: 1.5rem) {
          .event-details {
            @apply py-0 flex flex-row flex-nowrap items-center;
            font-size: 75%;
          }
        }

        @container (max-height: 54px) {
          .event-details {
            @apply flex flex-row items-center flex-nowrap;
          }
        }

        @container (min-height: 55px) {
          .event-description {
            display: block;
          }
        }
        `
  ]
})
export class TkdCalendarViewComponent implements OnInit {
  private readonly calendarAPI = inject(CALENDAR_SERVICE);
  private readonly rosterAPI = inject(ROSTER_SERVICE);
  private readonly userService = inject(UserService);
  private readonly activeRoute = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly renderer = inject(Renderer2);
  private readonly document = inject(DOCUMENT);
  private readonly message = inject(NzMessageService);
  private readonly config = inject(ConfigAPI);
  private readonly layout = inject(LayoutService)
    .withAutoUpdate()


  cursorTime$: Observable<Date> = of(new Date());

  data: LocalCalendar[] = [];
  isToday = false;
  currentDate: Date | null = null;

  readonly calendarType: LocalCalendar = null;

  @ViewChild(TkdDayViewComponent, { static: true })
  dayViewComponent!: TkdDayViewComponent<CalEvent, LocalCalendar>;

  private handleKeyPress(event: KeyboardEvent) {
    if (event.key === '+') {
      this.dayViewComponent?.zoomIn();
    }

    if (event.key === '-') {
      this.dayViewComponent?.zoomOut();
    }
  }

  handleCalendarClick(event: CalendarMouseEvent<CalEvent, LocalCalendar>) {
    console.log(event);
  }

  switchDate(offsetInDays: number) {
    this.setDate(
      new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), this.currentDate.getDate() + offsetInDays)
    )
  }

  loadToday() {
    this.setDate(new Date())
  }

  setDate(date: Date) {
    this.router.navigate([], {
      queryParams: {
        d: toDateString(date),
      },
      queryParamsHandling: 'merge'
    })
  }

  filterDisplayed = (cal: LocalCalendar) => cal.display;

  ngOnInit(): void {
    this.cursorTime$ = this.dayViewComponent
      .cursorTime$;

    this.destroyRef.onDestroy(
      this.renderer.listen(this.document, 'keypress', this.handleKeyPress.bind(this))
    );

    this.activeRoute
      .queryParamMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map(paramMap => paramMap.get("d")),
        filter(dateString => {
          if (dateString) {
            return true
          }

          this.router.navigate([], {
            queryParams: {
              d:toDateString(new Date()),
            },
            queryParamsHandling: 'merge'
          })

          return false;
        }),
        map(dateString => new Date(dateString)),
        switchMap(date => {
          const ref = this.message.loading("Termine werden geladen ...")

          return forkJoin({
            events: this.calendarAPI.listEvents({
              searchTime: {
                case: 'date',
                value: toDateString(date)
              },
              source: {
                case: 'allUsers',
                value: true,
              }
            }),
            shifts: this.rosterAPI.getUserShifts({
              timerange: {
                from: Timestamp.fromDate(new Date(date.getFullYear(), date.getMonth(), date.getDate())),
                to: Timestamp.fromDate(new Date(date.getFullYear(), date.getMonth(), date.getDate() +1 , 0, 0, -1)),
              },
              users: {
                allUsers: true,
              }
            }),
            date: of(date),
          })
            .pipe(
              tap({
                next: () => {
                  this.message.remove(ref.messageId)
                },
                error: err => {
                  this.message.remove(ref.messageId);
                }
              })
            )
        }),
        map(result => {
          const lm = new Map<string, WorkShift>();
          result.shifts.definitions.forEach(def => lm.set(def.id, def))

          return {
            calendars: result.events.results
              .map(eventList => {
                const user = this.userService.byCalendarID(eventList.calendar!.id);

                let local: LocalCalendar = {
                  id: eventList.calendar!.id,
                  name: eventList.calendar!.name,
                  user,
                  events: eventList.events.map(event => {
                    let localEvent: CalEvent = {
                      ...event,
                      from: event.startTime!,
                      duration: (event.endTime!.toDate().getTime() - event.startTime!.toDate().getTime()) / 1000,
                    }

                    return localEvent;
                  })
                }

                if (user && user.user) {
                  // gather all user shifts and prepend them to the events list
                  let shifts = result.shifts.shifts
                    .filter(shift => shift.assignedUserIds.includes(user.user.id))
                    .map(shift => {
                      let from = getSeconds(shift.from);
                      let duration = (shift.to.toDate().getTime() - shift.from.toDate().getTime()) / 1000;

                      if (shift.from.toDate().getTime() < result.date.getTime()) {
                        duration -= ((result.date.getTime() - shift.from.toDate().getTime()) / 1000);
                        from = 0;
                      }

                      let localEvent: CalEvent = {
                        calendarId: eventList.calendar!.id,
                        summary: lm.get(shift.workShiftId)?.name || 'unknown',
                        from: from,
                        duration: duration,
                        fullDay: false,
                        id: 'shift:' + shift.workShiftId + ":" + shift.from.toDate().toISOString() + "-" + shift.to.toDate().toISOString(),
                        description: '',
                        ignoreOverlapping: true,
                        isShiftType: true,
                      }

                      return localEvent;
                    })

                  local.events.splice(0, 0, ...shifts);
                }

                // if there are any calendar events for this calendar,
                // make sure to display it
                if (local.events.length > 0) {
                  local.display = true;
                }

                return local;
              }),

            date: result.date,
          };
        })
      )
      .subscribe(result => {
        this.data = result.calendars;
        this.currentDate = result.date;
        this.isToday = (new Date()).toDateString() == result.date.toDateString();
        this.cdr.markForCheck();
      });
  }
}

