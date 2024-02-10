import { Pipe, PipeTransform } from '@angular/core';
import { Timed } from './day-view.component';
import { coerceCssPixelValue } from '@angular/cdk/coercion';
import { Duration, Timestamp } from '@bufbuild/protobuf';
import { getSeconds } from './sort.pipe';

export interface StyledTimed extends Timed {
  style: {
    [key: string]: any;
  };
}

@Pipe({
  name: 'eventStyle',
  pure: true,
  standalone: true,
})
export class EventStylePipe implements PipeTransform {
  secondsToPixel(value: Duration | Timestamp | number, factor: number): number {
    return getSeconds(value) * factor;
  }

  transform(list: Timed[], factor: number, minHeight: number): StyledTimed[] {
    const done = new Map<string | number, number>();

    let hasOverlapping = (event: Timed, index: number, round: number) => {
      const eventStart = getSeconds(event.from);
      const eventEnd = eventStart + getSeconds(event.duration);

      for (let i = 0; i < index; i++) {
        const other = list[i];

        if (other.ignoreOverlapping) {
          continue;
        }

        const otherStart = getSeconds(other.from);
        const otherEnd = otherStart + getSeconds(other.duration);

        const startOverlaps = eventStart >= otherStart && eventStart < otherEnd;
        const endOverlaps = eventEnd >= otherStart && eventEnd < otherEnd;

        if (startOverlaps || endOverlaps) {
          if (
            round >= 0 &&
            (done.get(other.id) === round || done.get(other.id) === round - 1)
          ) {
            return true;
          }
        }
      }

      return false;
    };

    let round = 0;
    while (done.size < list.length) {
      for (let i = 0; i < list.length; i++) {
        const event = list[i];

        console.log(`round #${round}: ${event.id}`);

        // skip this one if it's already done.
        if (done.has(event.id)) {
          console.log(' -> event already done');
          continue;
        }

        if (event.ignoreOverlapping || !hasOverlapping(event, i, round)) {
          // calculate style
          const style: any = {
            top: this.secondsToPixel(event.from, factor) + 'px',
            height: this.secondsToPixel(event.duration, factor) + 'px',
            right: '0px',
            left: round * 10 + '%',
            zIndex: event.ignoreOverlapping ? 'unset' : (round + 1) * 5,
          };

          (event as any).style = style;

          console.log(' -> done');
          done.set(event.id, round);
        }
      }

      round++;
    }

    return list as any;
  }
}
