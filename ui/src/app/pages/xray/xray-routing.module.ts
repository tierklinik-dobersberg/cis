import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { XRayComponent } from "./xray";

const routes: Routes = [
    { path: '', component: XRayComponent }
]

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class XRayRoutingModule { }