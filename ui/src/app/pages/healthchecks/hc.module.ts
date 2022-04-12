import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { SharedModule } from "src/app/shared/shared.module";
import { StatsModule } from "../stats/stats.module";
import { HealthchecksRoutingModule } from "./hc-routing.module";
import { StatusPageComponent } from "./status-page";

@NgModule({
  imports: [
    CommonModule,
    SharedModule,
    HealthchecksRoutingModule,
    StatsModule
  ],
  declarations: [
    StatusPageComponent,
  ]
})
export class HealthchecksModule {}
