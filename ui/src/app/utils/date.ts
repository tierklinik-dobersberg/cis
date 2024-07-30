import { isAfter, isBefore, isEqual } from "date-fns";

export function isBetween(a: Date, range: [Date, Date]) {
  return (
    (isAfter(a, range[0]) || isEqual(a, range[0])) &&
    (isBefore(a, range[1]) || isEqual(a, range[1]))
  );
}