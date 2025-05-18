import { Pipe, PipeTransform } from '@angular/core';
import { OffTimeEntry } from '@tierklinik-dobersberg/apis/roster/v1';

@Pipe({
  name: 'matchingOfftime',
  pure: true,
  standalone: true,
})
export class MatchingOfftimePipe implements PipeTransform {

  transform(date: Date | string, entries: OffTimeEntry[]): OffTimeEntry[] {
    if (typeof date === 'string') {
      date = new Date(date)
    }

    const ts = date.getTime()

    return entries.filter(e => {
      const from = e.from?.toDate().getTime();
      const to = e.to?.toDate().getTime();

      if (!from || !to) {
        return false
      }

      return from <= ts && to >= ts;
    })
  }
}
