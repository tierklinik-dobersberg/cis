import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { CustomerListComponent } from "./customer-list";
import { CustomerViewComponent } from "./customer-view";

let routes: Routes = [
    { path: '', component: CustomerListComponent },
    { path: 'view/:source/:cid', component: CustomerViewComponent }
]

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class CustomerRoutingModule { }
