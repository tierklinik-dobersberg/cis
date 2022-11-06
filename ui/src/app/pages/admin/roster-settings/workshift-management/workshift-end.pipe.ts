import { Pipe, PipeTransform } from "@angular/core";
import { JSDuration } from "src/app/api/roster2";
import { padLeft } from "src/utils/strings";

@Pipe({
    name: 'workShiftEnd',
    pure: true,
})
export class TkdWorkShiftEndPipe implements PipeTransform {
    transform(from: string, duration: JSDuration) {
        if (!from) {
            return '';
        }

        const parts = from.split(":") 

        let minutes = (+parts[0])*60
        if (parts.length > 1) {
            parts[1] = parts[1].replace(/^[0]*/, '')
            minutes += (+parts[1])
        }

        const endTime = minutes + (duration / 1000 / 60)
        const endHours = Math.floor(endTime / 60)
        const endMinutes = ((endTime - (endHours * 60)))

        return padLeft(`${endHours}`, 2, "0") + ":" + padLeft(`${endMinutes}`, 2, "0")
    }
}