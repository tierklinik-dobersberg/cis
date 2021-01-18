import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { NzAvatarModule } from "ng-zorro-antd/avatar";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzGridModule } from "ng-zorro-antd/grid";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzListModule } from "ng-zorro-antd/list";
import { XRayComponent } from "./xray";
import { XRayRoutingModule } from "./xray-routing.module";

@NgModule({
    imports: [
        XRayRoutingModule,
        CommonModule,
        NzListModule,
        NzIconModule,
        NzGridModule,
        NzButtonModule,
        NzAvatarModule,
    ],
    exports: [
        XRayComponent,
    ],
    declarations: [
        XRayComponent,
    ]
})
export class XRayModule { }
