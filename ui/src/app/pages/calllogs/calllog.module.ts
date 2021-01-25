import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzCardModule } from "ng-zorro-antd/card";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { NzGridModule } from "ng-zorro-antd/grid";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzStatisticModule } from "ng-zorro-antd/statistic";
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { CallLogComponent } from "./calllog";
import { CallLogRoutingModule } from "./calllog-routing.module";

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        NzGridModule,
        NzCardModule,
        NzButtonModule,
        NzStatisticModule,
        NzIconModule,
        NzTableModule,
        NzToolTipModule,
        NzDatePickerModule,
        CallLogRoutingModule,
    ],
    declarations: [
        CallLogComponent,
    ],
    exports: [
        CallLogComponent
    ]
})
export class CallLogModule { }