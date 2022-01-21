import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { SharedModule } from "src/app/shared/shared.module";
import { StatsRoutingModule } from "./stats-routing.module";
import { StatsPageComponent } from "./stats.component";
import { NgChartsModule } from 'ng2-charts';
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { TimeChartComponent } from "./time-chart";
import { StatsChartComponent } from "./stats-chart";

@NgModule({
    imports: [
        StatsRoutingModule,
        CommonModule,
        SharedModule,
        NgChartsModule,
        NzDatePickerModule,
    ],
    declarations: [
        StatsPageComponent,
        TimeChartComponent,
        StatsChartComponent,
    ]
})
export class StatsModule { }
