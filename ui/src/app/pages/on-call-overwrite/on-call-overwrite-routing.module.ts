import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { OnCallOverwritePageComponent } from './overwrite-component';

const routes: Routes = [
  { path: 'overwrite', component: OnCallOverwritePageComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class OnCallOverwriteRoutingModule { }
