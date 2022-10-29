import { Pipe, PipeTransform } from "@angular/core";
import { JSDuration } from "src/app/api/roster2";
import { Duration } from "src/utils/duration";

@Pipe({
    name: 'jsDuration',
    pure: true,
})
export class TkdJSDurationPipe implements PipeTransform {
    transform(value: JSDuration, ...args: any[]) {
        return Duration.milliseconds(value).format('default-hours')
    }
}