import { Route, RouterModule } from "@angular/router";
import { RosterComponent } from "./roster.component";
import { NgModel } from "@angular/forms";
import { NgModule } from "@angular/core";

const routes: Route[] = [
  { path: '', component: RosterComponent }
]

@NgModule({
  imports: [
    RouterModule.forChild(routes),
  ],
  exports: [
    RouterModule
  ]
})
export class RosterRoutingModule {}
