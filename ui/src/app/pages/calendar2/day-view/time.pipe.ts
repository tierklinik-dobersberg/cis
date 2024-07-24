import { Pipe, PipeTransform } from '@angular/core';
import { Duration } from '@bufbuild/protobuf';
import { padLeft } from 'src/utils/strings';
import { DateInput } from './models';
import { getSeconds } from './sort.pipe';

@Pipe({
  name: 'time',
  standalone: true,
  pure: true,
})
export class TimeFormatPipe implements PipeTransform {
  static transform(value: DateInput | Duration) {
    const seconds = getSeconds(value);

    const hours = Math.floor(seconds / 60 / 60);
    const minutes = Math.floor((seconds - hours * 60 * 60) / 60);

    return `${padLeft(hours + '', 2, '0')}:${padLeft(minutes + '', 2, '0')}`;
  }

  transform(seconds: DateInput | Duration) {
    return TimeFormatPipe.transform(seconds);
  }
}
