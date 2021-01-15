import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { XRayComponent } from "./xray";
import { XRayRoutingModule } from "./xray-routing.module";

@NgModule({
    imports: [
        XRayRoutingModule,
        CommonModule,
    ],
    exports: [
        XRayComponent,
    ],
    declarations: [
        XRayComponent,
    ]
})
export class XRayModule { }
