import {
  AsyncPipe,
  NgClass,
  NgFor,
  NgForOf,
  NgIf,
  NgStyle,
  NgTemplateOutlet,
} from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  NgZone,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  TemplateRef,
  TrackByFunction,
  ViewChild,
  booleanAttribute,
  inject,
  isDevMode
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject,
  debounceTime,
  interval,
  map,
  share,
  startWith,
  switchMap,
  take
} from 'rxjs';
import { padLeft } from 'src/utils/strings';
import { EventStylePipe } from './event-style.pipe';
import { SecondsToPixelPipe } from './seconds-to-pixel.pipe';
import { SortPipe, getSeconds } from './sort.pipe';
import { TimeFormatPipe } from './time.pipe';
import { TkdCalendarHeaderCellTemplateDirective } from './header-cell.directive';
import { TkdCalendarEventCellTemplateDirective } from './event-cell.directive';
import { Calendar, CalendarMouseEvent, DateInput, Timed } from './models';
import { coerceDate } from './is-same-day.pipe';

export const DEFAULT_HOUR_HEIGHT_PX = 200;

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'tkd-day-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './day-view.component.html',
  standalone: true,
  exportAs: 'tkdDayView',
  imports: [
    NgFor,
    NgForOf,
    NgIf,
    NgStyle,
    NgTemplateOutlet,
    NgClass,
    AsyncPipe,
    SortPipe,
    SecondsToPixelPipe,
    EventStylePipe,
    TimeFormatPipe,
    TkdCalendarHeaderCellTemplateDirective,
    TkdCalendarEventCellTemplateDirective,
  ],
  styles: [
    `
          :host {
            display: flex;
            flex-direction: column;
          }
    
          .grid-container {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
          }
        `,
  ],
})
export class TkdDayViewComponent<E extends Timed, C extends Calendar<E>>
  implements OnInit, AfterViewInit, OnChanges
{
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);

  private viewInitialized = false;
  private lastScrollTop = 0;

  readonly eventType: E = null;
  readonly calendarType: C = null;

  private cursorY = 0;

  private _cursorTime$ = new BehaviorSubject<Date | null>(null);

  cursorTime$ = this._cursorTime$
    .pipe(
      debounceTime(1),
      share()
    );

  /** The current factor for calculating pixel offsets in the calendar */
  sizeFactor = DEFAULT_HOUR_HEIGHT_PX / 60 / 60;

  /** Minimum number of minutes for calendar entries */
  min = 15 * 60;

  hours = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    21, 22, 23,
  ];

  /** The list of calendars and events to render */
  @Input()
  data: C[];

  // The current date.
  @Input({ transform: coerceDate })
  currentDate: Date;

  /** A TemplateRef to render event cells */
  @Input()
  eventCell?: TkdCalendarEventCellTemplateDirective<E, C>;

  /** A TemplateRef to render calendar headers */
  @Input()
  headerCell?: TkdCalendarHeaderCellTemplateDirective<E, C>;

  @Input({ transform: booleanAttribute })
  showCurrentTime = false;

  @Input({ transform: booleanAttribute })
  autoScroll = false;

  /** Emits when the user clicks on a calendar */
  @Output()
  calendarClick = new EventEmitter<CalendarMouseEvent<E, C>>();

  /** The scrollable calendar container */
  @ViewChild('calendarContainer', { read: ElementRef, static: true })
  calendarContainer!: ElementRef<HTMLElement>;

  @HostListener('mousemove', ['$event'])
  handleMouseMove(event: MouseEvent) {
    this.cursorY = event.clientY;

    this.calculateCursorTime();
  }

  handleScroll(event: Event) {
    this.calculateCursorTime();
  }

  private calculateCursorTime() {
    const calContainer = this.calendarContainer.nativeElement;
    const offsetPixels = this.cursorY + calContainer.scrollTop - this.getOffsetSum(calContainer).top;
    const time = offsetPixels / this.sizeFactor;

    const cursorDate = this.createDate(time);

    this._cursorTime$.next(cursorDate);
  }


  /** TrackByFunction for calendars */
  trackCalendar: TrackByFunction<C> = (_, cal) => cal.id;

  /** TrackByFunction for calendar events */
  trackEvent: TrackByFunction<E> = (_, e) => e.id;

  /** The current time */
  currentTime$ = interval(45 * 1000).pipe(
    startWith(-1),
    takeUntilDestroyed(this.destroyRef),
    map(() => {
      return new Date()
    }),
    share({ connector: () => new BehaviorSubject(new Date()) })
  );

  scrollTo(seconds: number, behavior: ScrollBehavior = 'smooth') {
    const offset = seconds * this.sizeFactor;
    this.calendarContainer.nativeElement.scrollTo({
      top: offset,
      behavior,
    });
  }

  zoomIn(step = this.sizeFactor*0.05) {
    this.zoom(step);
  }

  zoomOut(step = this.sizeFactor*0.05) {
    this.zoom(-step);
  }

  private createDate(input: DateInput): Date {
    return new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), this.currentDate.getDate(), 0, 0, getSeconds(input));
  }

  private zoom(diff: number) {
    const currentCursorTime = getSeconds(this._cursorTime$.getValue());
    const scrollTopTime = this.calendarContainer.nativeElement.scrollTop / this.sizeFactor;
    const cursorTimeOffset = getSeconds(currentCursorTime) - scrollTopTime;
    const cursorPxOffset = cursorTimeOffset * this.sizeFactor;

    this.sizeFactor += diff;
    this.cdr.markForCheck();

    this.ngZone.onStable
      .pipe(
        take(1),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        const newScrollTop = (currentCursorTime - (cursorPxOffset / this.sizeFactor)) * this.sizeFactor;
        this.calendarContainer.nativeElement.scrollTop = newScrollTop;
      })
  }

  private getOffsetSum(elem: HTMLElement) {
    let top = 0;
    let left = 0;
    while (elem) {
      top = top + elem.offsetTop;
      left = left + elem.offsetLeft;

      elem = elem.offsetParent as HTMLElement;
    }

    return { top, left }
  }

  ngOnInit(): void {
    if (!this.eventCell) {
      throw new Error(`eventCell input must be specified`);
    }
  }

  private getFirstEventTime(ignoreOverlapping: boolean): number {
    let firstEvent = this.data.reduce((min, calendar) => {
      const calMin = calendar.events.reduce((min, event) => {
        if (ignoreOverlapping && event.ignoreOverlapping) {
          return min;
        }

        const start = getSeconds(event.from);
        if (start < min) {
          return start;
        }

        return min;
      }, Infinity);

      if (calMin < min) {
        return calMin;
      }

      return min;
    }, Infinity);

    return firstEvent;
  }

  private doAutoScroll() {
    if (this.autoScroll) {
      // if we show the current time we scroll there
      if (this.showCurrentTime) {
        const now = new Date();

        this.scrollTo(
          now.getHours() * 60 * 60 +
            now.getMinutes() * 60 +
            now.getSeconds() -
            // give it a 5 minute offset so the current-time line is not
            // directly on the top
            5 * 60
        );

        return;
      }

      // find the first calendar event that does not have "ignoreOverlapping" set
      let firstEvent = this.getFirstEventTime(true);

      if (firstEvent === Infinity) {
        // we did not find a "first event". Try again but take events with "ignoreOverlapping"
        // into account as well.
        firstEvent = this.getFirstEventTime(false);
      }

      if (firstEvent !== Infinity) {
        this.scrollTo(firstEvent);
      }
    }
  }

  ngAfterViewInit(): void {
    this.doAutoScroll();
    this.viewInitialized = true;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (('autoScroll' in changes || 'data' in changes) && this.viewInitialized) {
      this.ngZone.onStable
        .pipe(
          take(1),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe(() => this.doAutoScroll())
    }
  }

  handleCalendarClick(
    event: MouseEvent,
    cal: C,
    container: HTMLElement,
    dblclick: boolean
  ) {

    // find the actually clicked event container, if any
    let clickedEvent: HTMLElement = event.target as HTMLElement;
    while (!clickedEvent.getAttribute("event-id") && clickedEvent !== container) {
      clickedEvent = clickedEvent.parentElement;
    }
    if (!clickedEvent.getAttribute("event-id")) {
      clickedEvent = undefined;
    }

    // calculate the time of the click-event
    const offsetY = event.clientY - container.getBoundingClientRect().top;
    const seconds = offsetY / this.sizeFactor;

    // find all events that match the clicked time
    const events = cal.events.filter(evt => {
      const start = getSeconds(evt.from);
      const end = start + getSeconds(evt.duration);

      return start <= seconds && end >= seconds;
    });

    // get all hours elements and find the hour-anchor
    const hours = this.calendarContainer.nativeElement
      .querySelectorAll(`[calendar-id="${cal.id}"] div[hour]`)

    let anchor: HTMLDivElement = null;
    for(let idx = 1; idx < hours.length; idx++) {
      const hour = parseInt(hours.item(idx).getAttribute("hour")) * 60 * 60;

      if (hour > seconds) {
        anchor = hours.item(idx - 1) as HTMLDivElement;
        break;
      }
    }

    // if there's no anchor yet the last hour (23) has been clicked.
    if (!anchor) {
      anchor = hours.item(hours.length - 1) as HTMLDivElement;
    }

    // finally, emit the calendar-click event
    this.calendarClick.next({
      calendar: cal,
      doubleClick: dblclick,
      hourMarkerAnchor: anchor,
      events,
      date: this.createDate(seconds),
      clickedEventElement: clickedEvent,
      clickedEvent: clickedEvent ? events.find(evt => evt.id === clickedEvent.getAttribute("event-id")) : undefined,
    });
  }
}
