import { Pipe, PipeTransform } from '@angular/core';
import { Duration } from '@bufbuild/protobuf';
import { DateInput } from './models';
import { getSeconds } from './sort.pipe';

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
