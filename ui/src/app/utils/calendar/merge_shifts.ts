import { sortProtoTimestamps } from '@tierklinik-dobersberg/angular/behaviors';
import { TimeRange } from '@tierklinik-dobersberg/apis/common/v1';
import { PlannedShift } from '@tierklinik-dobersberg/apis/roster/v1';
import { isAfter, isBefore } from 'date-fns';
import { isBetween } from '../date';

export function mergePlannedShifts(shifts: PlannedShift[]): TimeRange[] {
  [...shifts].sort((a, b) => {
    let result = sortProtoTimestamps(a.from, b.from);
    if (result === 0) {
      result = sortProtoTimestamps(a.to, b.to);
    }

    return result;
  });

  let mergedShifts: TimeRange[] = [];
  for (let i = 0; i < shifts.length; i++) {
    if (i === 0) {
      mergedShifts.push(new TimeRange(shifts[i]));
      continue;
    }

    const shift = shifts[i];
    const prevShift = mergedShifts[mergedShifts.length - 1];

    const fromBetween = isBetween(shift.from.toDate(), [
      prevShift.from.toDate(),
      prevShift.to.toDate(),
    ]);
    const toBetween = isBetween(shift.to.toDate(), [
      prevShift.from.toDate(),
      prevShift.to.toDate(),
    ]);

    if (fromBetween || toBetween) {
      if (isBefore(shift.from.toDate(), prevShift.from.toDate())) {
        prevShift.from = shift.from;
      }

      if (isAfter(shift.to.toDate(), prevShift.to.toDate())) {
        prevShift.to = shift.to;
      }
    } else {
      mergedShifts.push(new TimeRange(shift));
    }
  }

  return mergedShifts;
}
