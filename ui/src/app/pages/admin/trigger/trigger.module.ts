import { NgModule } from "@angular/core";
import { NzModalModule } from "ng-zorro-antd/modal";
import { NzTableModule } from "ng-zorro-antd/table";
import { NzTabsModule } from "ng-zorro-antd/tabs";
import { SharedModule } from "src/app/shared/shared.module";
import { EditActionComponent } from "./edit-action";
import { TriggerListComponent } from "./trigger-list";
import { TriggerRoutingModule } from "./trigger-routing.module";
import { TriggerViewComponent } from "./trigger-view";

@NgModule({
  imports: [
    SharedModule,
    TriggerRoutingModule,
    NzModalModule,
    NzTableModule,
    NzTabsModule,
  ],
  declarations: [
    TriggerListComponent,
    TriggerViewComponent,
    EditActionComponent,
  ]
})
export class TriggerModule {}
