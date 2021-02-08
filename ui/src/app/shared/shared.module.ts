import { NgModule } from "@angular/core";
import { HeaderTitleOutlet } from "./header-title";
import { DurationPipe } from "./pipes";

@NgModule({
  declarations: [
    DurationPipe,
    HeaderTitleOutlet
  ],
  exports: [
    DurationPipe,
    HeaderTitleOutlet
  ]
})
export class SharedModule { }
