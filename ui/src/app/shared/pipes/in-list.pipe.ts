import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'inList'
})
export class InListPipe implements PipeTransform {

  transform<E, K extends keyof E, V extends E[K]>(value: V, list: E[], property: K): boolean;
  transform<E>(value: E, list: E[]): boolean;

  transform(value: any, list: any[], property?: string): boolean {
    if (property !== undefined) {
      return list.find(el => el[property] === value) !== undefined;
    }

    return list.find(value) !== undefined
  }

}
