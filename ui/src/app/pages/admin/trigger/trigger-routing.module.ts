import { NgModule } from "@angular/core";
import { Route, RouterModule } from "@angular/router";
import { TriggerListComponent } from "./trigger-list";
import { TriggerViewComponent } from "./trigger-view";

const routes: Route[] = [
  { path: '', component: TriggerListComponent },
  { path: ':name', component: TriggerViewComponent }
]

@NgModule({
  imports: [
    RouterModule.forChild(routes)
  ],
  exports: [
    RouterModule
  ]
})
export class TriggerRoutingModule {}
