import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { CustomerListComponent } from "./customer-list";

let routes: Routes = [
    { path: '', component: CustomerListComponent }
]

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class CustomerRoutingModule { }
