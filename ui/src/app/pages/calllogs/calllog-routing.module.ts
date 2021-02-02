import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { CallLogComponent } from "./calllog";

const routes: Routes = [
    { path: '', component: CallLogComponent },
]

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class CallLogRoutingModule { }