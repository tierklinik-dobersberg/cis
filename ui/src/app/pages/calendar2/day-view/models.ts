import { Duration, Timestamp } from '@bufbuild/protobuf';

export interface Timed {
  id: string | number;
  from: Timestamp | number;
  duration: Duration | number;
  ignoreOverlapping?: boolean;
  calendarId: string;
}

export interface Calendar {
  /** A unique id of the calendar */
  id: string;

  /** The name of the calendar */
  name: string;
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
