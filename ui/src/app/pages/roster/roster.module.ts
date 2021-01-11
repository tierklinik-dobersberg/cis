import { NgModule } from "@angular/core";
import { RosterComponent } from "./roster";
import { RosterRoutingModule } from "./roster-routing.module";

@NgModule({
  imports: [
    RosterRoutingModule,
  ],
  declarations: [
    RosterComponent,
  ],
  exports: [
    RosterComponent,
  ]
})
export class RosterModule { }
