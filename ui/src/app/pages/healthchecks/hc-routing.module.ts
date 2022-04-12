import { NgModule } from "@angular/core";
import { Route, RouterModule } from "@angular/router";
import { StatusPageComponent } from "./status-page";

const routes: Route[] = [
  { path: '', component: StatusPageComponent }
]

@NgModule({
  imports: [
    RouterModule.forChild(routes),
  ],
  exports: [
    RouterModule,
  ]
})
export class HealthchecksRoutingModule {}
