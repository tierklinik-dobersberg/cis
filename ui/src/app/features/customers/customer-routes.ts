import { Route } from '@angular/router';

export const CUSTOMER_ROUTES: Route[] = [
  {
    path: ':customerId',
    loadComponent: () => import("./customer-details").then(m => m.CustomerDetailsComponent)
  },
  {
    path: ':customerId/patient/:patientId',
    loadComponent: () => import("./customer-details").then(m => m.CustomerDetailsComponent)
  }
];


