import { LayoutModule } from "@angular/cdk/layout";
import { CdkScrollableModule, ScrollingModule } from '@angular/cdk/scrolling';
import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { NzAvatarModule } from "ng-zorro-antd/avatar";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzGridModule } from "ng-zorro-antd/grid";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzListModule } from "ng-zorro-antd/list";
import { NzMessageServiceModule } from "ng-zorro-antd/message";
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzRadioModule } from "ng-zorro-antd/radio";
import { NzPopoverModule } from 'ng-zorro-antd/popover';
import { NzSpinModule } from "ng-zorro-antd/spin";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { DxrDatePipe } from "./dxr-date.pipe";
import { OhifOwnerNamePipe } from "./ohif-owner-name.pipe";
import { ViewerComponent } from "./viewer";
import { XRayComponent } from "./xray";
import { XRayRoutingModule } from "./xray-routing.module";
import { NzDrawerModule } from "ng-zorro-antd/drawer";
import { PreviewUrlPipe } from "./preview-url.pipe";

@NgModule({
    imports: [
        XRayRoutingModule,
        CommonModule,
        FormsModule,
        NzListModule,
        NzIconModule,
        NzGridModule,
        NzButtonModule,
        NzAvatarModule,
        NzMessageServiceModule,
        NzModalModule,
        NzToolTipModule,
        NzRadioModule,
        NzSpinModule,
        NzInputModule,
        NzProgressModule,
        NzPopoverModule,
        NzDrawerModule,
        NzDropDownModule,
        LayoutModule,
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
        OhifOwnerNamePipe,
        PreviewUrlPipe,
    ]
})
export class XRayModule { }
