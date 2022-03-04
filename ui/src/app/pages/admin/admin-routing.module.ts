import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminOverviewComponent } from './admin';
import { ImportPageComponent } from './import';

const routes: Routes = [
  { path: '', component: AdminOverviewComponent },
  { path: 'import', component: ImportPageComponent },
  {
    path: 'identity',
    loadChildren: () =>
      import('./users/users.module').then((m) => m.UsersModule),
  },
  {
    path: 'settings',
    loadChildren: () => import('./settings').then((m) => m.SettingsModule),
  },
  {
    path: 'trigger',
    loadChildren: () => import('./trigger').then((m) => m.TriggerModule),
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminRoutingModule {}
