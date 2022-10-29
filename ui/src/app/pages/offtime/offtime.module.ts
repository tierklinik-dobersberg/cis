import { NgModule } from "@angular/core";
import { NzBadgeModule } from "ng-zorro-antd/badge";
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzRadioModule } from "ng-zorro-antd/radio";
import { NzTabsModule } from "ng-zorro-antd/tabs";
import { SharedModule } from "src/app/shared/shared.module";
import { TkdCreateOfftimeRequestComponent } from "./create-offtime-request";
import { TkdDaysBetweenPipe } from "./days-between.pipe";
import { TkdJSDurationPipe } from "./duration.pipe";
import { TkdMyOffTimeRequestsComponent } from "./my-offtime-requests";
import { TkdOffTimeManagementComponent } from "./offtime-management";
import { TkdApproveRejectOffTimeRequestComponent } from "./offtime-management/approve-reject-request";
import { TkdGrantOffTimeCredits } from "./offtime-management/grant-offtime-credits";
import { TkdOffTimeRequestManagementComponent } from "./offtime-management/request-management";
import { TkdOfftimeRoutingModule } from "./offtime-routing.module";
import { TkdRequestTypePipe } from "./request-type.pipe";

@NgModule({
    imports: [
        SharedModule,
        NzDatePickerModule,
        TkdOfftimeRoutingModule,
        NzRadioModule,
        NzTabsModule,
        NzBadgeModule,
        NzDropDownModule
    ],
    declarations: [
        TkdCreateOfftimeRequestComponent,
        TkdMyOffTimeRequestsComponent,
        TkdDaysBetweenPipe,
        TkdJSDurationPipe,
        TkdOffTimeRequestManagementComponent,
        TkdOffTimeManagementComponent,
        TkdGrantOffTimeCredits,
        TkdApproveRejectOffTimeRequestComponent,
        TkdRequestTypePipe
    ],
    exports: [
        TkdCreateOfftimeRequestComponent,
    ]
})
export class TkdOfftimeModule {}