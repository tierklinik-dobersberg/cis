import { Pipe, PipeTransform } from "@angular/core";
import { ConstraintViolation } from "src/app/api/roster2";

@Pipe({
    name: 'constraintViolation',
    pure: true
})
export class TkdConstraintViolationPipe implements PipeTransform {
    transform(value: ConstraintViolation[]): string {
        if (value.length === 0) {
            return '';
        }

        const firstHard = value.find(p => p.hard === true);
        if (firstHard) {
            switch (firstHard.type) {
                case 'off-time':
                    return 'Urlaubsantrag: ' + firstHard.name
                default:
                    return 'unsupported'
            }
        }

        switch (value[0].type) {
            case 'off-time':
                return 'Urlaubsantrag: ' + value[0].name
            default:
                return 'unsupported'
        }
    }
}