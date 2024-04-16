import { NgModule } from "@angular/core";
import { DateInputComponent } from "./date-input";
import { DateRangeInputDirective } from "./date-range-input";
import { NativeDateInputStringPipe } from "./native-input.pipe";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    NzDatePickerModule
  ],
  declarations: [
    DateInputComponent,
    DateRangeInputDirective,
    NativeDateInputStringPipe,
  ],
  exports: [
    DateInputComponent,
    DateRangeInputDirective
  ]
})
export class TkdDateInputModule {}
