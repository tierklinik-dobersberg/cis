import { isDevMode, Pipe, PipeTransform } from '@angular/core';
import { Duration, DurationLayout } from 'src/utils/duration';

export type InputUnit = "ns" | "µs" | "ms" | "s" | "m" | "h";

@Pipe({
  name: 'duration',
  pure: true
})
export class DurationPipe implements PipeTransform {
  transform(value: string | number, layout: DurationLayout = "default", input: InputUnit = "s"): string {
    console.log(value);
    let d: Duration;
    switch (input) {
      case "h":
        d = Duration.hours(+value);
        break;
      case "m":
        d = Duration.minutes(+value);
        break;
      case "s":
        d = Duration.seconds(+value);
        break;
      case "ms":
        d = Duration.milliseconds(+value);
        break;
      case "µs":
        d = Duration.microseconds(+value);
        break;
      case "ns":
        d = Duration.nanoseconds(+value);
        break
      default:
        if (isDevMode()) {
          return "WRONG_LAYOUT"
        }
        return ""
    }
    return d.format(layout)
  }
}
