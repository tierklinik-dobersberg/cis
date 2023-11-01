import { NzMessageModule } from 'ng-zorro-antd/message';
import { NgModule } from "@angular/core";
import { SharedModule } from "src/app/shared/shared.module";
import { OfftimeRoutingModule } from "./offtime-routing.module";
import { OffTimeListComponent } from "./offtime-list/offtime-list.component";
import { OffTimeCreateComponent } from './offtime-create/offtime-create.component';

@NgModule({
  imports: [
    SharedModule,
    OfftimeRoutingModule,
    NzMessageModule
  ],
  declarations: [
    OffTimeListComponent,
    OffTimeCreateComponent,
  ]
})
export class OfftimeModule {}

