import { NgModule } from '@angular/core';
import { Route, RouterModule } from '@angular/router';
import { HasChangesGuard } from 'src/app/shared/has-changes-guard';
import { TkdRosterOverviewComponent } from './overview';
import { TkdRosterPlannerComponent } from './planner/roster-planner.component';


const routes: Route[] = [
  { path: '', component: TkdRosterOverviewComponent },
  { path: 'plan/:year/:month', component: TkdRosterPlannerComponent, canDeactivate: [HasChangesGuard] },
  { path: 'view/:year/:month', component: TkdRosterPlannerComponent, data: { readonly: true } }
]

@NgModule({
  imports: [
    RouterModule.forChild(routes)
  ]
})
export class TkdRoster2Routing {}
