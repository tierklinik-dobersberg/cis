import { NgModule } from "@angular/core";
import { Route, RouterModule } from "@angular/router";
import { OffTimeListComponent } from "./offtime-list/offtime-list.component";
import { OffTimeCreateComponent } from "./offtime-create/offtime-create.component";

const routes: Route[] = [
  { path: '', pathMatch: 'full', component: OffTimeListComponent },
  { path: 'create', component: OffTimeCreateComponent },
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
