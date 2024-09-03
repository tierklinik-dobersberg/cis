import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminOverviewComponent } from './admin';

const routes: Routes = [
  { path: '', component: AdminOverviewComponent },
  {
    path: 'settings',
    loadChildren: () => import('./settings').then((m) => m.SettingsModule),
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminRoutingModule {}
