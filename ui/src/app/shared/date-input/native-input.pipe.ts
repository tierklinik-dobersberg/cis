import { Pipe, PipeTransform} from '@angular/core';
import { DateInput } from './date-input';
import { CandyDate } from 'ng-zorro-antd/core/time';

@Pipe({
  name: 'toNativeDateString',
  pure: true
})
export class NativeDateInputStringPipe implements PipeTransform {
  transform(value: DateInput | null, withTime = false) {
    if (!value) {
      return null
    }

    const date = new CandyDate(value).nativeDate;

    if (withTime) {
      return dateForDateTimeInputValue(date)
    }

    return toDateString(date);
  }
}

export function dateForDateTimeInputValue(date: Date): string {
  return new Date(date.getTime() + date.getTimezoneOffset() * -60 * 1000).toISOString().slice(0, 19);
}

export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${padLeft(''+(d.getMonth()+1), 2, '0')}-${padLeft(''+d.getDate(), 2, '0')}`
}

function padLeft(str: string, length: number, pad = ' '): string {
    while (str.length < length) {
        str = pad + str;
    }
    return str;
}
