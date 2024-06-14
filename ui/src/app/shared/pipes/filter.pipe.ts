import { Pipe, PipeTransform } from "@angular/core";

@Pipe({
  name: 'filter',
  pure: true,
  standalone: true
})
export class FilterPipe implements PipeTransform {
  transform<T>(list: T[], fn: (value: T, index: number) => boolean) {
    return list.filter(fn);
  }
}
