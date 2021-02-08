import { NgModule } from "@angular/core";
import { DurationPipe } from "./pipes";

@NgModule({
  declarations: [
    DurationPipe,
  ],
  exports: [
    DurationPipe,
  ]
})
export class SharedModule { }
