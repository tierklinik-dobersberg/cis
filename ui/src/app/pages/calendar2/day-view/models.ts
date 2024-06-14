import { Duration, Timestamp } from '@bufbuild/protobuf';
import { StringOrNumberOrDate } from '@swimlane/ngx-charts';

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
