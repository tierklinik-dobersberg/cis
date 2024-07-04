import { NgModule } from "@angular/core";
import { RosterComponent } from "./roster.component";
import { RosterRoutingModule } from "./roster-routing.module";
import { SharedModule } from "src/app/shared/shared.module";
import { HlmButtonModule } from "@tierklinik-dobersberg/angular/button";

@NgModule({
  imports: [
    RosterRoutingModule,
    HlmButtonModule,
    SharedModule,
  ],
  declarations: [
    RosterComponent,
  ]
})
export class RosterModule {}
