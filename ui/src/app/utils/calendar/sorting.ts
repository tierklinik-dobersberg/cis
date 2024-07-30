import { sortProtoTimestamps } from '@tierklinik-dobersberg/angular/behaviors';
import { CalendarEvent } from '@tierklinik-dobersberg/apis';

export function sortCalendarEvents(a: CalendarEvent, b: CalendarEvent): number {
  let result = sortProtoTimestamps(a.startTime, b.startTime);
  if (result === 0) {
    result = sortProtoTimestamps(a.endTime, b.endTime);
  }

  if (result === 0) {
    return a.summary.localeCompare(b.summary);
  }

  return result;
}
