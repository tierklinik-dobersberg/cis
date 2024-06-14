import { Pipe, PipeTransform } from '@angular/core';
import { Timestamp } from '@bufbuild/protobuf';
import { DateInput } from './models';


export function coerceDate(input: DateInput): Date {
  if (input instanceof Date) {
    return input
  }

  if (input instanceof Timestamp) {
    return input.toDate()
  }

  return new Date(input * 1000);
}

@Pipe({
  name: 'isSameDay',
  pure: true,
  standalone: true,
})
export class IsSameDayPipe implements PipeTransform {
   static transform(date: DateInput, compare: DateInput) {
      return coerceDate(date).toDateString() === coerceDate(compare).toDateString();
   }

  transform(date: DateInput, compare: DateInput) {
    return IsSameDayPipe.transform(date, compare)
  }
}

