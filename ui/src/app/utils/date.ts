import { isAfter, isBefore, isEqual, setHours, setMinutes, setSeconds } from "date-fns";

export function isBetween(a: Date, range: [Date, Date]) {
  return (
    (isAfter(a, range[0]) || isEqual(a, range[0])) &&
    (isBefore(a, range[1]) || isEqual(a, range[1]))
  );
}

export function setHms(d: Date, hour: number, minute: number, seconds: number): Date {
  return setHours(
    setMinutes(
      setSeconds(
        d, seconds
      ),
      minute,
    ),
    hour,
  )
}