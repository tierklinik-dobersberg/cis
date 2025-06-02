import { Duration, Timestamp } from '@bufbuild/protobuf';

export interface Timed {
  /** The ID of the event */
  id: string | number;

  /** A unique ID of the event, this is required for calculating the event style correctly if 
   * an event is displayed multiple times accross different calendars.
   */
  uniqueId: string | number;

  /** The start time of the event */
  from: Timestamp | number;

  /** The event duration */
  duration: Duration | number;

  /** Whether or not overlapping should be ignored when calculating event styles. */
  ignoreOverlapping?: boolean;

  /** The ID of the calendar this event belongs to */
  calendarId: string;

  /** A list of resources for this event */
  resources: string[];

  /** Whether or not this event is a virtual copy - i.e. displayed in a resource calendar. */
  virtualCopy: boolean;
}

export interface SwipeEvent {
  directionX: 'left' | 'right' | '';
  directionY: 'up' | 'down' | '';

  deltaX: number;
  deltaY: number;
}

export interface Calendar {
  /** A unique id of the calendar */
  id: string;

  /** The name of the calendar */
  name: string;

  isVirtualResource: boolean;
}

export interface CalendarMouseEvent<T extends Timed, C extends Calendar> {
  // The calendar that has been clicked.
  calendar: C;

  // The actual date
  date: Date;

  // Whether or not this was a dblclick.
  doubleClick: boolean;

  // The matching hour-marker that may be used as an anchor for
  // popovers or other overlays.
  hourMarkerAnchor: HTMLDivElement;

  // A list of events at the clicked time.
  events: T[];

  clickedEvent?: T;
  clickedEventElement?: HTMLElement;
}

export type DateInput = number | Date | Timestamp;
