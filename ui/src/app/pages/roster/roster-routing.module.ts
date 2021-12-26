import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RosterComponent } from './roster';
import { RosterOverwritePageComponent } from './roster-overwrite';

const routes: Routes = [
  { path: '', component: RosterComponent },
  { path: 'overwrite', component: RosterOverwritePageComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class RosterRoutingModule { }
