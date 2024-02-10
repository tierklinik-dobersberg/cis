import {
  NgFor,
  NgForOf,
  NgIf,
  NgStyle,
  NgTemplateOutlet,
} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  TemplateRef,
  TrackByFunction,
  isDevMode,
} from '@angular/core';
import { SecondsToPixelPipe } from './seconds-to-pixel.pipe';
import { Timestamp, Duration } from '@bufbuild/protobuf';
import { MinPipe } from './min.pipe';
import { SortPipe } from './sort.pipe';
import { EventStylePipe } from './event-style.pipe';
import { padLeft } from 'src/utils/strings';

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
  imports: [
    NgFor,
    NgForOf,
    NgIf,
    NgStyle,
    SortPipe,
    SecondsToPixelPipe,
    EventStylePipe,
    NgTemplateOutlet,
  ],
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
      }

      .grid-container {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(10em, 25em));
      }
    `,
  ],
})
export class TkdDayViewComponent<T extends Timed, C extends Calendar<T>>
  implements OnInit
{
  /** The current factor for calculating pixel offsets in the calendar */
  sizeFactor = DEFAULT_HOUR_HEIGHT_PX / 60 / 60;

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

  /** Emits when a calendar is hovered */
  @Output()
  onCalendarHover = new EventEmitter<CalendarMouseEvent<T, C>>();

  /** Emits when the user clicks on a calendar */
  @Output()
  onCalendarClick = new EventEmitter<CalendarMouseEvent<T, C>>();

  /** TrackByFunction for calendars */
  trackCalendar: TrackByFunction<C> = (_, cal) => cal.id;

  /** TrackByFunction for calendar events */
  trackEvent: TrackByFunction<T> = (_, e) => e.id;

  ngOnInit(): void {
    if (!this.eventCell) {
      throw new Error(`eventCell input must be specified`);
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
