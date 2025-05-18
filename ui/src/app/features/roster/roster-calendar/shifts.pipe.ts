import { Pipe, PipeTransform } from "@angular/core";
import { PlannedShift } from "@tierklinik-dobersberg/apis/roster/v1";
import { isSameDay } from "date-fns";

@Pipe({
    standalone: true,
    pure: true,
    name: 'shifts',
})
export class ShiftsPipe implements PipeTransform {
    transform(date: Date, shifts: PlannedShift[]) {
        return shifts.filter(shift => isSameDay(shift.from.toDate(), date)) 
    }
}