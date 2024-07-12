import { isDevMode, Pipe, PipeTransform } from '@angular/core';
import { Duration as ProtoDuration } from '@bufbuild/protobuf';
import { Duration, DurationLayout } from 'src/utils/duration';

export type InputUnit = 'ns' | 'µs' | 'ms' | 's' | 'm' | 'h';

@Pipe({
  name: 'duration',
  pure: true,
})
export class DurationPipe implements PipeTransform {
  transform(value: string | number | ProtoDuration, layout: DurationLayout = 'default', input: InputUnit = 's', skipSeconds = false): string {
    let d: Duration;
    if (value instanceof ProtoDuration) {
      d = Duration.fromProto(value)
    } else {
    switch (input) {
      case 'h':
        d = Duration.hours(+value);
        break;
      case 'm':
        d = Duration.minutes(+value);
        break;
      case 's':
        d = Duration.seconds(+value);
        break;
      case 'ms':
        d = Duration.milliseconds(+value);
        break;
      case 'µs':
        d = Duration.microseconds(+value);
        break;
      case 'ns':
        d = Duration.nanoseconds(+value);
        break;
      default:
        if (isDevMode()) {
          return 'WRONG_LAYOUT';
        }
        return '';
    }
    }

    return d.format(layout, skipSeconds);
  }
}
