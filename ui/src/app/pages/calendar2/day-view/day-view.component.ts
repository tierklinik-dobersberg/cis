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
  OnChanges,
  SimpleChanges,
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
import { BehaviorSubject, interval, map, share, startWith, take } from 'rxjs';
import { TkdDebounceEventDirective } from 'src/app/components/debounce-event.directive';
import { TkdCalendarEventCellTemplateDirective } from './event-cell.directive';
import { EventStylePipe } from './event-style.pipe';
import { TkdCalendarHeaderCellTemplateDirective } from './header-cell.directive';
import { coerceDate } from './is-same-day.pipe';
import { Calendar, CalendarMouseEvent, DateInput, Timed } from './models';
import { SecondsToPixelPipe } from './seconds-to-pixel.pipe';
import { getSeconds } from './sort.pipe';
import { TimeFormatPipe } from './time.pipe';

export const DEFAULT_HOUR_HEIGHT_PX = 200;

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
    EventStylePipe,
    TimeFormatPipe,
    TkdCalendarHeaderCellTemplateDirective,
    TkdCalendarEventCellTemplateDirective,
    TkdDebounceEventDirective,
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
export class TkdDayViewComponent<E extends Timed>
  implements AfterViewInit, OnChanges
{
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);

  private viewInitialized = false;

  readonly eventType: E = null;
  readonly calendarType: Calendar = null;

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
  public readonly events = input<E[]>([])

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
    
    return calendars
      .filter(cal => idsToDisplay.has(cal.id))
      .map(cal => {
        return {
          ...cal,
          events: sorted.filter(e => {
            if (e.virtualCopy) {
              return cal.isVirtualResource && e.resources.includes(cal.id)
            }

            return e.calendarId === cal.id
          })
        }
      })
  })
  
  /* The currently displayed date */
  public readonly currentDate = input.required<Date, DateInput>({
    transform: coerceDate,
  });

  /** A TemplateRef to render event cells */
  @ContentChild(TkdCalendarEventCellTemplateDirective)
  protected readonly eventCell?: TkdCalendarEventCellTemplateDirective<E, Calendar>;

  /** A TemplateRef to render calendar headers */
  @ContentChild(TkdCalendarHeaderCellTemplateDirective)
  protected readonly headerCell?: TkdCalendarHeaderCellTemplateDirective<E, Calendar>;

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

  @HostListener('mousemove', ['$event'])
  protected handleMouseMove(event: MouseEvent) {
    this.cursorY = event.clientY;

    this.calculateCursorTime();
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
      this.sizeFactor()

      this.zoom()
    })
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
    this.calendarContainer.nativeElement.scrollTo({
      top: offset,
      behavior,
    });
  }

  zoomIn(step = this.sizeFactor() * 0.05) {
    this.sizeFactor.set(this.sizeFactor() + step)
  }

  zoomOut(step = this.sizeFactor() * 0.05) {
    this.sizeFactor.set(this.sizeFactor() - step)
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
    if (this.scrolled) {
      return;
    }
    
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
        this.scrollTo(firstEvent);
      }
    }
  }

  ngAfterViewInit(): void {
    this.viewInitialized = true;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('currentDate' in changes) {
      this.scrolled = false;
    }
    
    this.ngZone
      .onStable
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.doAutoScroll())
  }

  handleCalendarClick(
    event: MouseEvent,
    cal: Calendar,
    container: HTMLElement,
    dblclick: boolean
  ) {
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
    const events = this.events()
      .filter(evt => {
        if (evt.calendarId !== cal.id && (!evt.virtualCopy || !evt.resources.includes(cal.id))) {
          return false;
        }

        const start = getSeconds(evt.from);
        const end = start + getSeconds(evt.duration);

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
        ? events.find(evt => evt.uniqueId === clickedEvent.getAttribute('event-id'))
        : undefined,
    });
  }
}
