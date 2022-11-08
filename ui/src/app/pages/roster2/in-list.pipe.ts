import { Pipe, PipeTransform } from "@angular/core";

@Pipe({
    name: 'inList',
    pure: true
})
export class TkdInListPipe implements PipeTransform {
    transform<T>(value: T, list: Iterable<T>|ArrayLike<T>|Set<T>): boolean {
        if (list === null || list === undefined) {
            return false;
        }

        if (list instanceof Set) {
            return list.has(value)
        }

        return Array.from(list).some(t => t === value) ;
    }
}