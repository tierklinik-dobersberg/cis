import { Duration } from '@bufbuild/protobuf';
import { CalendarEvent } from '@tierklinik-dobersberg/apis/calendar/v1';
import { getSeconds } from 'src/app/pages/calendar2/day-view/sort.pipe';
import { isBetween } from '../date';

export class CalendarEventHole {
  public readonly duration: Duration;

  constructor(
    public readonly from: Date,
    public readonly to: Date
  ) {
    this.duration = new Duration({
      seconds: BigInt(getSeconds(to) - getSeconds(from)),
    });
  }
}

export function findCalendarHoles(
  start: Date,
  end: Date,
  events: CalendarEvent[]
): CalendarEventHole[] {
  const breaks: CalendarEventHole[] = [];

  const shiftRange = [start, end] as [Date, Date];

  // find all events within the configured shift.
  const eventsInShift = events.filter(event => {
    const eventStart = event.startTime.toDate();
    const eventEnd = event.endTime?.toDate();

    return (
      isBetween(eventStart, shiftRange) ||
      isBetween(eventEnd, shiftRange) ||
      isBetween(start, [eventStart, eventEnd]) ||
      isBetween(end, [eventStart, eventEnd])
    );
  });

  for (let i = 0; i <= eventsInShift.length; i++) {
    let beginningOfHole =
      i === 0
        ? start.getTime()
        : eventsInShift[i - 1].endTime.toDate().getTime();
    let endOfHole =
      i === eventsInShift.length
        ? end.getTime()
        : eventsInShift[i].startTime.toDate().getTime();
    if (beginningOfHole < endOfHole) {
      breaks.push(
        new CalendarEventHole(new Date(beginningOfHole), new Date(endOfHole))
      );
    }
  }

  return breaks;
}
