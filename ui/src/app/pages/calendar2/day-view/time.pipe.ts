import { Pipe, PipeTransform } from '@angular/core';
import { padLeft } from 'src/utils/strings';

@Pipe({
  name: 'time',
  standalone: true,
  pure: true,
})
export class TimeFormatPipe implements PipeTransform {
  transform(seconds: number, ...args: any[]) {
    const hours = Math.floor(seconds / 60 / 60);
    const minutes = Math.floor((seconds - hours * 60 * 60) / 60);

    return `${padLeft(hours + '', 2, '0')}:${padLeft(minutes + '', 2, '0')}`;
  }
}
