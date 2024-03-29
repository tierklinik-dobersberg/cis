import { Pipe, PipeTransform } from '@angular/core';
import { Timed } from './day-view.component';
import { Duration, Timestamp } from '@bufbuild/protobuf';

export function getSeconds(b: number | Duration | Timestamp): number {
  if (b instanceof Duration) {
    return Number(b.seconds);
  }

  if (b instanceof Timestamp) {
    return Number(b.seconds);
  }

  return b;
}

@Pipe({
  name: 'sort',
  pure: true,
  standalone: true,
})
export class SortPipe implements PipeTransform {
  transform(events: Timed[]): Timed[] {
    let copy = [...events];

    copy.sort((a, b) => {
      let da = getSeconds(a.duration);
      let db = getSeconds(b.duration);

      let sa = getSeconds(a.from);
      let sb = getSeconds(b.from);

      if (sb < sa) {
        return 1;
      }

      if (sb > sa) {
        return -1;
      }

      return db - da;
    });

    console.log(copy);

    return copy;
  }
}
