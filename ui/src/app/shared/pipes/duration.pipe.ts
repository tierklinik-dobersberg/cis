import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'duration',
  pure: true
})
export class DurationPipe implements PipeTransform {
  transform(value: string | number): string {
    const secondsNum = typeof value === 'string'
      ? parseInt(value, 10) // don't forget the second param
      : value;
    let hours: string | number = Math.floor(secondsNum / 3600);
    let minutes: string | number = Math.floor((secondsNum - (hours * 3600)) / 60);
    let seconds: string | number = secondsNum - (hours * 3600) - (minutes * 60);

    if (hours < 10) { hours = '0' + hours; }
    if (minutes < 10) { minutes = '0' + minutes; }
    if (seconds < 10) { seconds = '0' + seconds; }

    return hours + ':' + minutes + ':' + seconds;
  }
}
