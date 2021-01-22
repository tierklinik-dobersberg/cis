import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

var routes: Routes = [
    { path: 'customers', loadChildren: () => import('./customer/customer.module').then(m => m.CustomerModule) }
]

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class AdminRoutingModule { }