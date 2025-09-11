import { Route } from '@angular/router';
import { ComputerAccountGuard } from 'src/app/guards';

export const OFFTIME_ROUTES: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./offtime-list/offtime-list.component').then(m => m.OffTimeListComponent),
  },
  {
    path: 'create',
    canActivate: [ComputerAccountGuard],
    loadComponent: () => import("./offtime-create/offtime-create.component").then(m => m.OffTimeCreateComponent),
  },
];

