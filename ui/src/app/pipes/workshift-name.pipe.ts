import { Pipe, PipeTransform } from "@angular/core";
import { WorkShift } from "@tierklinik-dobersberg/apis/roster/v1";

@Pipe({
    name: 'workshift',
    pure: true,
    standalone: true,
})
export class WorkShiftPipe implements PipeTransform {
    transform(shiftId: string, shifts: WorkShift[]) {
        const shift = shifts.find(s => s.id === shiftId) ;

        if (!shift) {
            return new WorkShift();
        }

        return shift;
    }
}