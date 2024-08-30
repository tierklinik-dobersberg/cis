import { Route } from '@angular/router';
import { ComputerAccountGuard } from 'src/app/guards';
import { OffTimeCreateComponent } from './offtime-create/offtime-create.component';
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
    component: OffTimeCreateComponent,
  },
];

