import { Route } from '@angular/router';
import { ComputerAccountGuard } from 'src/app/guards';
import { OffTimeListComponent } from './offtime-list/offtime-list.component';

export const OFFTIME_ROUTES: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    component: OffTimeListComponent,
  },
  {
    path: 'create',
    canActivate: [ComputerAccountGuard],
    loadComponent: () => import("./offtime-create/offtime-create.component").then(m => m.OffTimeCreateComponent),
  },
];

