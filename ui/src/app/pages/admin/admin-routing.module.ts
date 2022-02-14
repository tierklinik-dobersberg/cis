import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminOverviewComponent } from './admin';
import { ImportPageComponent } from './import';

const routes: Routes = [
  { path: '', component: AdminOverviewComponent },
  { path: 'import', component: ImportPageComponent },
  { path: 'identity', loadChildren: () => import("./users/users.module").then(m => m.UsersModule) },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule { }
