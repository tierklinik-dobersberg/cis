import { Date as PbDate } from '@tierklinik-dobersberg/apis/common/v1';
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

export function toProtoDate(date: Date | null): PbDate | null {
  if (!date) {
    return null
  }

  return new PbDate({
    day: date.getDate(),
    month: (date.getMonth() + 1),
    year: BigInt(date.getFullYear())
  })
}