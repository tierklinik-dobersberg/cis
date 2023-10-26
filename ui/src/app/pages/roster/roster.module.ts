import { NgModule } from "@angular/core";
import { RosterComponent } from "./roster.component";
import { RosterRoutingModule } from "./roster-routing.module";
import { SharedModule } from "src/app/shared/shared.module";

@NgModule({
  imports: [
    RosterRoutingModule,
    SharedModule,
  ],
  declarations: [
    RosterComponent,
  ]
})
export class RosterModule {}
