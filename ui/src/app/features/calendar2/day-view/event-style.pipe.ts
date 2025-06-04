import { Pipe, PipeTransform } from '@angular/core';
import { Duration, Timestamp } from '@bufbuild/protobuf';
import { Timed } from './models';
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
    return Math.round(getSeconds(value) * factor);
  }

  transform(list: Timed[], factor: number, minDuration: number = 15 * 60): StyledTimed[] {
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
            (done.get(other.uniqueId) === round)
          ) {

            return true;
          }
        }
      }

      return false;
    };

    let round = 0;
    while (done.size < list.length) {
      let didSomething = false;

      for (let i = 0; i < list.length; i++) {
        const event = list[i];
        const id = event.uniqueId;

        // skip this one if it's already done.
        if (done.has(id)) {
          continue;
        }

        if (event.ignoreOverlapping || !hasOverlapping(event, i, round)) {
          didSomething = true;

          let duration = getSeconds(event.duration);
          if (duration < minDuration) {
            duration = minDuration
          }

          // calculate style
          const style: any = {
            top: (round * 5 + this.secondsToPixel(event.from, factor)) + 'px',
            height: this.secondsToPixel(duration, factor) + 'px',
            right: '0px',
            left: round * 25 + '%',
            zIndex: event.ignoreOverlapping ? 'unset' : (round + 1) * 5,
          };

          
          (event as any).style = style;

          done.set(id, round);
        }
      }

      if (!didSomething) {
        console.error("endless loop while calculating calendar event style")
        debugger;
        break;
      }

      round++;
    }

    return list as any;
  }
}
