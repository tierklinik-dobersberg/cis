import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { SharedModule } from "src/app/shared/shared.module";
import { StatsRoutingModule } from "./stats-routing.module";
import { StatsPageComponent } from "./stats.component";
import { NgChartsModule } from 'ng2-charts';
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { TimeChartComponent } from "./time-chart";
import { StatsChartComponent } from "./stats-chart";
import { CounterStatComponent } from "./counter";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";

@NgModule({
    imports: [
        StatsRoutingModule,
        CommonModule,
        SharedModule,
        NgChartsModule,
        NzDatePickerModule,
        NzDropDownModule
    ],
    declarations: [
        StatsPageComponent,
        TimeChartComponent,
        StatsChartComponent,
        CounterStatComponent,
    ],
    exports: [
      TimeChartComponent,
      StatsChartComponent,
    ]
})
export class StatsModule { }
