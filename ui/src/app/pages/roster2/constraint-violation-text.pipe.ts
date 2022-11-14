import { Pipe, PipeTransform } from "@angular/core";
import { ConstraintViolation } from "src/app/api/roster2";

@Pipe({
    name: 'constraintViolation',
    pure: true
})
export class TkdConstraintViolationPipe implements PipeTransform {
    transform(value: ConstraintViolation[]): string[] {
        if (value.length === 0) {
            return [];
        }

        return value.map(val => {
          let prefix = '';
          switch (val.type) {
            case 'constraint':
              prefix = 'Regel'
              break;

            case 'off-time':
              prefix = 'Abwesenheit'
              break;

            default:
              prefix = val.type
          }

          if (!val.name) {
            return prefix;
          }

          return `${prefix}: ${val.name}`
        })
    }
}
