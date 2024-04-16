import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'min',
  pure: true,
  standalone: true,
})
export class MinPipe implements PipeTransform {
  transform(val: number, min: number): number {
    if (val < min) {
      return min;
    }

    return val;
  }
}
