import { Pipe, PipeTransform } from "@angular/core";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
import { JSDuration } from "src/app/api/roster2";
import { padLeft } from "src/utils/strings";

@Pipe({
    name: 'workShiftEnd',
    pure: true,
})
export class TkdWorkShiftEndPipe implements PipeTransform {
    constructor(private san: DomSanitizer) {}

    transform(from: string, duration: JSDuration): string;
    transform(from: string, duration: JSDuration, spanClass: string): SafeHtml;

    transform(from: string, duration: JSDuration, spanClass: string = '') {
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
        let endHours = Math.floor(endTime / 60)
        const endMinutes = ((endTime - (endHours * 60)))

        let suffix = '';
        if (endHours >= 24) {
          const dayOffset = Math.floor(endHours / 24)
          endHours -= (dayOffset * 24);

          if (dayOffset === 1) {
            suffix = 'am nächsten Tag'
          } else {
            suffix = `in ${dayOffset} Tagen`
          }

          if (spanClass !== '') {
            suffix = `<span class="${spanClass}">${suffix}</span>`
          }
        }

        const result = padLeft(`${endHours}`, 2, "0") + ":" + padLeft(`${endMinutes}`, 2, "0") + " " + suffix;

        if (spanClass !== '') {
          return this.san.bypassSecurityTrustHtml(result)
        }

        return result;
    }
}
