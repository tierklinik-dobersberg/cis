import { Pipe, PipeTransform } from '@angular/core';
import { Duration, Timestamp } from '@bufbuild/protobuf';
import { getSeconds } from './sort.pipe';
import { DateInput } from './models';

@Pipe({
  name: 'secondsToPixel',
  pure: true,
  standalone: true,
})
export class SecondsToPixelPipe implements PipeTransform {
  transform(value: DateInput | Duration, factor: number): number {
    value = getSeconds(value);

    return value * factor;
  }
}
