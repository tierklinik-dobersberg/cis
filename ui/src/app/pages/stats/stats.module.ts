import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { NgxChartsModule } from "@swimlane/ngx-charts";
import { SharedModule } from "src/app/shared/shared.module";
import { StatsRoutingModule } from "./stats-routing.module";
import { StatsPageComponent } from "./stats.component";

@NgModule({
    imports: [
        StatsRoutingModule,
        CommonModule,
        SharedModule,
        NgxChartsModule,
    ],
    declarations: [
        StatsPageComponent,
    ]
})
export class StatsModule {}