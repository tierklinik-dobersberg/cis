import {
  AsyncPipe,
  NgFor,
  NgForOf,
  NgIf,
  NgStyle,
  NgTemplateOutlet,
} from '@angular/common';
import {
  AfterViewChecked,
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  TemplateRef,
  TrackByFunction,
  ViewChild,
  booleanAttribute,
  inject,
  isDevMode,
} from '@angular/core';
import { SecondsToPixelPipe } from './seconds-to-pixel.pipe';
import { Timestamp, Duration } from '@bufbuild/protobuf';
import { MinPipe } from './min.pipe';
import { SortPipe, getSeconds } from './sort.pipe';
import { EventStylePipe } from './event-style.pipe';
import { padLeft } from 'src/utils/strings';
import {
  BehaviorSubject,
  interval,
  map,
  multicast,
  share,
  startWith,
  take,
} from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TimeFormatPipe } from './time.pipe';

export const DEFAULT_HOUR_HEIGHT_PX = 200;

export interface Timed {
  id: string | number;
  from: Timestamp | number;
  duration: Duration | number;
  ignoreOverlapping?: boolean;
}

export interface Calendar<T extends Timed> {
  /** A unique id of the calendar */
  id: string;

  /** The name of the calendar */
  name: string;

  /** A list of events to render */
  events: T[];
}

export interface CalendarMouseEvent<T extends Timed, C extends Calendar<T>> {
  calendar: C;
  seconds: number;
  doubleClick: boolean;
}

@Component({
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
    AsyncPipe,
    SortPipe,
    SecondsToPixelPipe,
    EventStylePipe,
    TimeFormatPipe,
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
export class TkdDayViewComponent<T extends Timed, C extends Calendar<T>>
  implements OnInit, AfterViewInit
{
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

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

  /** A TemplateRef to render event cells */
  @Input()
  eventCell?: TemplateRef<T>;

  /** A TemplateRef to render calendar headers */
  @Input()
  headerCell?: TemplateRef<C>;

  @Input({ transform: booleanAttribute })
  showCurrentTime = false;

  @Input({ transform: booleanAttribute })
  autoScroll = false;

  /** Emits when the user clicks on a calendar */
  @Output()
  onCalendarClick = new EventEmitter<CalendarMouseEvent<T, C>>();

  /** The scrollable calendar container */
  @ViewChild('calendarContainer', { read: ElementRef, static: true })
  calendarContainer!: ElementRef<HTMLElement>;

  /** TrackByFunction for calendars */
  trackCalendar: TrackByFunction<C> = (_, cal) => cal.id;

  /** TrackByFunction for calendar events */
  trackEvent: TrackByFunction<T> = (_, e) => e.id;

  /** The current time */
  currentTime$ = interval(45 * 1000).pipe(
    startWith(-1),
    takeUntilDestroyed(this.destroyRef),
    map(() => {
      const now = new Date();

      return (
        now.getHours() * 60 * 60 + now.getMinutes() * 60 + now.getSeconds()
      );
    }),
    share({ connector: () => new BehaviorSubject(0) })
  );

  scrollTo(seconds: number) {
    const offset = seconds * this.sizeFactor;
    this.calendarContainer.nativeElement.scrollTo({
      top: offset,
      behavior: 'smooth',
    });
  }

  zoomIn(step = 0.01) {
    this.sizeFactor += step;
    this.cdr.markForCheck();
  }

  zoomOut(step = 0.01) {
    this.sizeFactor -= step;
    this.cdr.markForCheck();
  }

  ngOnInit(): void {
    if (!this.eventCell) {
      throw new Error(`eventCell input must be specified`);
    }
  }

  ngAfterViewInit(): void {
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
      const firstEvent = this.data.reduce((min, calendar) => {
        const calMin = calendar.events.reduce((min, event) => {
          if (event.ignoreOverlapping) {
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

      if (firstEvent !== Infinity) {
        this.scrollTo(firstEvent);
      }
    }
  }

  handleCalendarClick(
    event: MouseEvent,
    cal: C,
    container: HTMLElement,
    dblclick: boolean
  ) {
    const offsetY = event.clientY - container.getBoundingClientRect().top;

    const seconds = offsetY / this.sizeFactor;

    if (isDevMode()) {
      const hours = Math.floor(seconds / 60 / 60);
      const minutes = Math.floor((seconds - hours * 60 * 60) / 60);

      console.log(
        `${padLeft(hours + '', 2, '0')}:${padLeft(minutes + '', 2, '0')}`
      );
    }

    this.onCalendarClick.next({
      seconds: seconds,
      calendar: cal,
      doubleClick: dblclick,
    });
  }
}
