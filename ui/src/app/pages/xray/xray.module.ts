import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { NzAvatarModule } from "ng-zorro-antd/avatar";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzGridModule } from "ng-zorro-antd/grid";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzListModule } from "ng-zorro-antd/list";
import { NzModalModule } from 'ng-zorro-antd/modal';
import { CdkScrollableModule, ScrollingModule } from '@angular/cdk/scrolling';
import { XRayComponent } from "./xray";
import { XRayRoutingModule } from "./xray-routing.module";
import { NzMessageServiceModule } from "ng-zorro-antd/message";
import { DxrDatePipe } from "./dxr-date.pipe";
import { OhifOwnerNamePipe } from "./ohif-owner-name.pipe";
import { ViewerComponent } from "./viewer";

@NgModule({
    imports: [
        XRayRoutingModule,
        CommonModule,
        NzListModule,
        NzIconModule,
        NzGridModule,
        NzButtonModule,
        NzAvatarModule,
        NzMessageServiceModule,
        NzModalModule,
        CdkScrollableModule,
        ScrollingModule
    ],
    exports: [
        XRayComponent,
    ],
    declarations: [
        XRayComponent,
        DxrDatePipe,
        ViewerComponent,
        OhifOwnerNamePipe
    ]
})
export class XRayModule { }
