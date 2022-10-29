import { Pipe, PipeTransform } from "@angular/core";

@Pipe({
    name: 'daysBetween',
    pure: true,
})
export class TkdDaysBetweenPipe implements PipeTransform {
    transform(value: [Date|string, Date|string], ...args: any[]) {
        value[0] = new Date(value[0])
        value[1] = new Date(value[1])

        let difference = value[0].getTime() - value[1].getTime();
        let days = Math.ceil(difference / (1000 * 3600 * 24));
        return days;
    }
}
