import { Timestamp } from '@bufbuild/protobuf';
import { Pipe, PipeTransform } from "@angular/core";

@Pipe({
  name: 'toDate',
  pure: true
})
export class ToDatePipe implements PipeTransform {
  transform(value: Timestamp | Date | string | number, ...args: any[]): Date {
    if (value instanceof Timestamp) {
      value = value.toDate();
    }

    if (typeof value === 'string') {
      value = new Date(value)
    }

    if (typeof value === 'number') {
      value = new Date(value * 1000)
    }

    return value;
  }
}
