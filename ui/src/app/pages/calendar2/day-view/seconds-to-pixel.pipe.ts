import { coerceCssPixelValue } from '@angular/cdk/coercion';
import { Pipe, PipeTransform } from '@angular/core';
import { Duration, Timestamp } from '@bufbuild/protobuf';

@Pipe({
  name: 'secondsToPixel',
  pure: true,
  standalone: true,
})
export class SecondsToPixelPipe implements PipeTransform {
  transform(value: number | Duration | Timestamp, factor: number): number {
    if (value instanceof Duration) {
      value = Number(value.seconds);
    }

    if (value instanceof Timestamp) {
      value = Number(value.seconds);
    }

    return value * factor;
  }
}
