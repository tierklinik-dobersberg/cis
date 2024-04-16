import { ChangeDetectorRef, Directive, Host, Optional } from "@angular/core";
import { DateInputComponent } from "./date-input";


@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: 'tkd-date-range-input',
})
export class DateRangeInputDirective {
  constructor(
    @Host() @Optional() dateInput: DateInputComponent,
    @Host() cdr: ChangeDetectorRef
    ) {
    dateInput.isRangeInput = true
    cdr.markForCheck();
  }
}
