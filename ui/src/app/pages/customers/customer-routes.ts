import { Route } from '@angular/router';
import { CustomerListComponent } from './customer-list';

export const CUSTOMER_ROUTES: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    component: CustomerListComponent,
  },
];


