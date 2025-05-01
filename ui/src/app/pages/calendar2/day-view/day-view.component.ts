import {
  CdkDrag,
  CdkDragRelease,
  CdkDragStart,
  DragDropModule
} from '@angular/cdk/drag-drop';
import { AsyncPipe, NgClass, NgStyle, NgTemplateOutlet } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ContentChild,
  DestroyRef,
  ElementRef,
  HostListener,
  NgZone,
  ViewChild,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LayoutService } from '@tierklinik-dobersberg/angular/layout';
import { getMinutes, setMinutes, setSeconds } from 'date-fns';
import { BehaviorSubject, interval, map, share, startWith, take } from 'rxjs';
import { TkdDebounceEventDirective } from 'src/app/components/debounce-event.directive';
import { TkdDragResetDirective } from './drag-reset.directive';
import { TkdCalendarEventCellTemplateDirective } from './event-cell.directive';
import { TkdEventResizeDirective } from './event-resize.directive';
import { EventStylePipe, StyledTimed } from './event-style.pipe';
import { TkdCalendarHeaderCellTemplateDirective } from './header-cell.directive';
import { coerceDate } from './is-same-day.pipe';
import {
  Calendar,
  CalendarMouseEvent,
  DateInput,
  SwipeEvent,
  Timed,
} from './models';
import { SecondsToPixelPipe } from './seconds-to-pixel.pipe';
import { getSeconds } from './sort.pipe';
import { TimeFormatPipe } from './time.pipe';

export const DEFAULT_HOUR_HEIGHT_PX = 200;

export interface EventMovedEvent<E> {
  event: E;
  date: Date;
  calendarId: string;
  drag: CdkDrag;
}

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'tkd-day-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './day-view.component.html',
  standalone: true,
  exportAs: 'tkdDayView',
  imports: [
    NgStyle,
    NgTemplateOutlet,
    NgClass,
    AsyncPipe,
    SecondsToPixelPipe,
    TimeFormatPipe,
    TkdCalendarHeaderCellTemplateDirective,
    TkdCalendarEventCellTemplateDirective,
    TkdDebounceEventDirective,
    DragDropModule,
    TkdDragResetDirective,
    TkdEventResizeDirective,
  ],
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
      }

      .grid-container {
        display: grid;
      }
    `,
  ],
})
export class TkdDayViewComponent<E extends Timed> implements AfterViewInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);

  private viewInitialized = false;

  readonly eventType: E = null;
  readonly calendarType: Calendar = null;

  public readonly headerSwipe = output<SwipeEvent>();
  public readonly calendarSwipe = output<SwipeEvent>();
  public readonly eventMoved = output<EventMovedEvent<E>>();

  protected readonly layout = inject(LayoutService)

  private cursorY = 0;

  /** The current timestamp under the cursor */
  public cursorTime = signal<Date | null>(null);

  protected readonly _computedGridTemplateColumns = computed(() => {
    const data = this.displayCalendars();

    return data.map(() => '1fr').join(' ');
  });

  /** The current factor for calculating pixel offsets in the calendar */
  public readonly sizeFactor = model(DEFAULT_HOUR_HEIGHT_PX / 60 / 60);

  /** Minimum number of minutes for calendar entries */
  protected readonly min = 15 * 60;

  protected readonly hours = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    21, 22, 23,
  ];

  /** The list of calendars and events to render */
  public readonly calendars = input<Calendar[]>([]);

  /** A list of calendar ids to display */
  public readonly displayCalendars = input<string[]>([]);

  /** The actual events to display. */
  public readonly events = input<E[]>([]);

  public readonly onResize = output<{event: StyledTimed, duration: number}>()

  protected readonly _computedCalendarsToDisplay = computed(() => {
    const calendars = this.calendars();
    const idsToDisplay = new Set(this.displayCalendars());
    const events = this.events();

    const sorted = [...events].sort((a, b) => {
      let da = getSeconds(a.duration);
      let db = getSeconds(b.duration);

      let sa = getSeconds(a.from);
      let sb = getSeconds(b.from);

      if (sb < sa) {
        return 1;
      }

      if (sb > sa) {
        return -1;
      }

      return db - da;
    });

    const styler = new EventStylePipe();
    const size = this.sizeFactor();

    return calendars
      .filter(cal => idsToDisplay.has(cal.id))
      .map(cal => {
        return {
          ...cal,
          events: styler.transform(
            sorted.filter(e => {
              if (e.virtualCopy) {
                return cal.isVirtualResource && e.resources.includes(cal.id);
              }

              return e.calendarId === cal.id;
            }),
            size
          ),
        };
      });
  });

  /* The currently displayed date */
  public readonly currentDate = input.required<Date, DateInput>({
    transform: coerceDate,
  });

  /** A TemplateRef to render event cells */
  @ContentChild(TkdCalendarEventCellTemplateDirective)
  protected readonly eventCell?: TkdCalendarEventCellTemplateDirective<
    E,
    Calendar
  >;

  /** A TemplateRef to render calendar headers */
  @ContentChild(TkdCalendarHeaderCellTemplateDirective)
  protected readonly headerCell?: TkdCalendarHeaderCellTemplateDirective<
    E,
    Calendar
  >;

  /** Whether or not to show the current time marker */
  public readonly showCurrentTime = input(false, {
    transform: booleanAttribute,
  });

  /** Whether or not the calendar should scroll to the current time / first event */
  public readonly autoScroll = input(false, { transform: booleanAttribute });
  public scrolled = false;

  /** Emits when the user clicks on a calendar */
  public readonly calendarClick = output<CalendarMouseEvent<E, Calendar>>();

  /** The scrollable calendar container */
  @ViewChild('calendarContainer', { read: ElementRef, static: true })
  protected readonly calendarContainer!: ElementRef<HTMLElement>;

  private activeDrags: CdkDrag[] = [];

  private startY: number | null = null;

  @HostListener('mousemove', ['$event'])
  protected handleMouseMove(event: MouseEvent) {
    this.cursorY = event.clientY;

    this.calculateCursorTime();
  }

  private resizeEvent: StyledTimed | null = null;
  onResizeStart(event: { event: MouseEvent; data: StyledTimed }) {
    console.log("resize start")

    this.dragging.set(true);

    this.resizeEvent = event.data;
    this.startY = event.event.clientY;
  }

  onResizeStop(event: MouseEvent) {

    console.log("resize stopped")

    if (!this.resizeEvent) {
      return
    }

    if (this.startY === event.clientY)  {
      this.dragging.set(false);
      return
    }

    const height = parseFloat(this.resizeEvent.style.height.replace('px', ''));

    const seconds = height / this.sizeFactor();
    this.onResize.emit({
      event: this.resizeEvent,
      duration: seconds,
    })

    this.resizeEvent = null;
  }

  @HostListener('mousemove', ['$event'])
  protected handleResize(event: MouseEvent) {
    const ce = this.resizeEvent;

    if (this.startY !== null && ce !== null) {
      // update the event style
      const offset = event.clientY - this.startY;
      const style = { ...ce.style };
      let durationOffset = offset / this.sizeFactor();

      let duration = getSeconds(ce.duration) + durationOffset;

      if (duration < 15 *60) {
        duration = 15*60;
      }

      duration = Math.ceil(duration / (15*60)) * 15 * 60

      style.height =
        (duration * this.sizeFactor()) + 'px';

      ce.style = style;
    }
  }

  protected handleScroll(event: Event) {
    this.calculateCursorTime();
  }

  private calculateCursorTime() {
    const calContainer = this.calendarContainer.nativeElement;
    const offsetPixels =
      this.cursorY +
      calContainer.scrollTop -
      this.getOffsetSum(calContainer).top;
    const time = offsetPixels / this.sizeFactor();

    const cursorDate = this.createDate(time);

    this.cursorTime.set(cursorDate);
  }

  constructor() {
    effect(() => {
      this.sizeFactor();

      this.zoom();
    });

    let prevDate: Date | null = null;
    effect(() => {
      const events = this.events();
      const currentDate = this.currentDate();

      /*
      this.activeDrags.forEach(d => {
        try {
          d.reset();
        } catch(err) {

        }
      })
      this.activeDrags = [];
      */

      if (!prevDate || prevDate.getTime() != currentDate.getTime()) {
        this.doAutoScroll();
        prevDate = currentDate;
      }
    });
  }

  /** The current time */
  currentTime$ = interval(45 * 1000).pipe(
    startWith(-1),
    takeUntilDestroyed(this.destroyRef),
    map(() => {
      return new Date();
    }),
    share({ connector: () => new BehaviorSubject(new Date()) })
  );

  scrollTo(seconds: number, behavior: ScrollBehavior = 'smooth') {
    const offset = seconds * this.sizeFactor();
    console.log('scrolling to ', offset);
    this.calendarContainer.nativeElement.scrollTo({
      top: offset,
      behavior,
    });
  }

  protected handleHeaderSwipe(evt: HammerInput) {
    if (evt.distance < 100) {
      return;
    }

    const x =
      Math.abs(evt.deltaX) > 40 ? (evt.deltaX > 0 ? 'right' : 'left') : '';
    const y = Math.abs(evt.deltaY) > 40 ? (evt.deltaY > 0 ? 'down' : 'up') : '';

    if (y !== '') {
      return;
    }

    this.headerSwipe.emit({
      deltaX: evt.deltaX,
      deltaY: evt.deltaY,
      directionX: x,
      directionY: y,
    });
  }

  protected handleCalendarSwipe(evt: HammerInput) {
    if (evt.distance < 80) {
      return;
    }

    const x =
      Math.abs(evt.deltaX) > 40 ? (evt.deltaX > 0 ? 'right' : 'left') : '';
    const y = Math.abs(evt.deltaY) > 80 ? (evt.deltaY > 0 ? 'down' : 'up') : '';

    if (y !== '') {
      return;
    }

    this.calendarSwipe.emit({
      deltaX: evt.deltaX,
      deltaY: evt.deltaY,
      directionX: x,
      directionY: y,
    });
  }

  zoomIn(step = this.sizeFactor() * 0.05) {
    this.sizeFactor.set(this.sizeFactor() + step);
  }

  zoomOut(step = this.sizeFactor() * 0.05) {
    this.sizeFactor.set(this.sizeFactor() - step);
  }

  private createDate(input: DateInput): Date {
    const current = this.currentDate();
    return new Date(
      current.getFullYear(),
      current.getMonth(),
      current.getDate(),
      0,
      0,
      getSeconds(input)
    );
  }

  private zoom() {
    const currentCursorTime = getSeconds(this.cursorTime());
    const scrollTopTime =
      this.calendarContainer.nativeElement.scrollTop / this.sizeFactor();
    const cursorTimeOffset = getSeconds(currentCursorTime) - scrollTopTime;
    const cursorPxOffset = cursorTimeOffset * this.sizeFactor();

    this.ngZone.onStable
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const newScrollTop =
          (currentCursorTime - cursorPxOffset / this.sizeFactor()) *
          this.sizeFactor();
        this.calendarContainer.nativeElement.scrollTop = newScrollTop;
      });
  }

  private getOffsetSum(elem: HTMLElement) {
    let top = 0;
    let left = 0;
    while (elem) {
      top = top + elem.offsetTop;
      left = left + elem.offsetLeft;

      elem = elem.offsetParent as HTMLElement;
    }

    return { top, left };
  }

  private getFirstEventTime(ignoreOverlapping: boolean): number {
    let firstEvent = this.events().reduce((min, event) => {
      if (ignoreOverlapping && event.ignoreOverlapping) {
        return min;
      }

      const start = getSeconds(event.from);
      if (start < min) {
        return start;
      }

      return min;
    }, Infinity);

    return firstEvent;
  }

  private doAutoScroll() {
    //if (this.scrolled) {
    //  console.log("not scrolling")
    //  return;
    //}

    if (this.autoScroll()) {
      // if we show the current time we scroll there
      if (this.showCurrentTime()) {
        const now = new Date();

        this.scrollTo(
          now.getHours() * 60 * 60 +
            now.getMinutes() * 60 +
            now.getSeconds() -
            // give it a 5 minute offset so the current-time line is not
            // directly on the top
            5 * 60
        );

        console.log('scrolled to now');
        this.scrolled = true;
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
        this.scrolled = true;
        console.log('scrolled to first event');
        this.scrollTo(firstEvent);
      }
    }
  }

  ngAfterViewInit(): void {
    this.viewInitialized = true;
  }

  public readonly dragging = model(false);

  onDragStart(event: CdkDragStart) {
    this.activeDrags.push(event.source);
  }

  onEventDropped(event: CdkDragRelease) {
    if (!this.layout.md()) {
      event.source.reset()
      return
    }

    const elementBounds =
      event.source.element.nativeElement.getBoundingClientRect();
    const eventId = event.source.element.nativeElement.getAttribute('event-id');

    const newPos = {
      x: (event.event as MouseEvent).clientX,
      y: elementBounds.y,
    };

    const calendars =
      this.calendarContainer.nativeElement.querySelectorAll('[calendar-id]');

    const cal = Array.from(calendars).find(cal => {
      const bounds = cal.getBoundingClientRect();

      if (bounds.x <= newPos.x && bounds.x + bounds.width >= newPos.x) {
        return true;
      }

      return false;
    });

    const offsetY = newPos.y - cal.getBoundingClientRect().top;
    const seconds = offsetY / this.sizeFactor();
    let date = this.createDate(seconds);

    event.event.preventDefault();
    event.event.stopPropagation();
    event.event.stopImmediatePropagation();

    // clip to 15 minutes slots
    date = setSeconds(date, 0);
    date = setMinutes(date, Math.round(getMinutes(date) / 15) * 15);

    const calEvent = this.events().find(e => e.id === eventId);

    this.eventMoved.emit({
      event: calEvent,
      date: date,
      calendarId: cal.getAttribute('calendar-id'),
      drag: event.source,
    });
  }

  handleCalendarClick(
    event: MouseEvent,
    cal: Calendar,
    container: HTMLElement,
    dblclick: boolean
  ) {
    console.log("handle calendar click", this.dragging())

    if (this.dragging()) {
      this.dragging.set(false);
      return;
    }

    // find the actually clicked event container, if any
    let clickedEvent: HTMLElement = event.target as HTMLElement;
    while (
      !clickedEvent.getAttribute('event-id') &&
      clickedEvent !== container
    ) {
      clickedEvent = clickedEvent.parentElement;
    }
    if (!clickedEvent.getAttribute('event-id')) {
      clickedEvent = undefined;
    }

    // calculate the time of the click-event
    const offsetY = event.clientY - container.getBoundingClientRect().top;
    const seconds = offsetY / this.sizeFactor();

    // find all events that match the clicked time
    const events = this.events().filter(evt => {
      if (
        evt.calendarId !== cal.id &&
        (!evt.virtualCopy || !evt.resources.includes(cal.id))
      ) {
        return false;
      }

      const start = getSeconds(evt.from);
      let end = start + getSeconds(evt.duration);

      if (end - start < 10 * 60) {
        end = start + 10 * 60;
      }

      return start <= seconds && end >= seconds;
    });

    // get all hours elements and find the hour-anchor
    const hours = this.calendarContainer.nativeElement.querySelectorAll(
      `[calendar-id="${cal.id}"] div[hour]`
    );

    let anchor: HTMLDivElement = null;
    for (let idx = 1; idx < hours.length; idx++) {
      const hour = parseInt(hours.item(idx).getAttribute('hour')) * 60 * 60;

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
    this.calendarClick.emit({
      calendar: cal,
      doubleClick: dblclick,
      hourMarkerAnchor: anchor,
      events,
      date: this.createDate(seconds),
      clickedEventElement: clickedEvent,
      clickedEvent: clickedEvent
        ? events.find(
            evt => evt.uniqueId === clickedEvent.getAttribute('event-id')
          )
        : undefined,
    });
  }
}
