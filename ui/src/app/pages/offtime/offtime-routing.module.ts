import { NgModule } from "@angular/core";
import { Route, RouterModule } from "@angular/router";
import { OffTimeListComponent } from "./offtime-list/offtime-list.component";

const routes: Route[] = [
  { path: '', pathMatch: 'full', component: OffTimeListComponent },
  { path: 'create', loadComponent: () => import("./offtime-create/offtime-create.component").then(m => m.OffTimeCreateComponent) },
]

@NgModule({
  imports: [
    RouterModule.forChild(routes),
  ],
  exports: [
    RouterModule
  ],
})
export class OfftimeRoutingModule {}
