import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzTableModule } from "ng-zorro-antd/table";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { CallLogTableComponent } from "./callog-table";
import { HeaderTitleOutlet } from "./header-title";
import { DurationPipe } from "./pipes";

@NgModule({
  imports: [
    NzTableModule,
    NzToolTipModule,
    NzIconModule,
    CommonModule,
    FormsModule,
    RouterModule,
  ],
  declarations: [
    DurationPipe,
    HeaderTitleOutlet,
    CallLogTableComponent
  ],
  exports: [
    DurationPipe,
    HeaderTitleOutlet,
    CallLogTableComponent
  ]
})
export class SharedModule { }
