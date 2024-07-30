import { Routes } from '@angular/router';
import { OverwriteOverviewComponent } from './overwrite-overview';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: OverwriteOverviewComponent,
  },
  {
    path: 'create',
    loadComponent: () =>
      import('./overwrite-component').then(m => m.OnCallOverwritePageComponent),
  },
];
