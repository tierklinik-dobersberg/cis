import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./pages/welcome/welcome.component').then(m => m.WelcomeComponent) },
  { path: 'on-call', loadComponent: () => import('./pages/on-call-overwrite/overwrite-overview').then(m => m.OverwriteOverviewComponent) },
  { path: 'calllogs', loadComponent: () => import('./pages/calllogs/calllog').then(m => m.CallLogComponent) },
  { path: 'admin', loadChildren: () => import('./pages/admin/admin.module').then(m => m.AdminModule) },
  { path: 'voicemail/:name', loadComponent: () => import('./pages/voicemails/voicemail.component').then(m => m.VoiceMailComponent) },
  { path: 'calendar', loadComponent: () => import('./pages/calendar2/calendar-view/calendar-view.component').then(m => m.TkdCalendarViewComponent) },
  { path: 'offtime', loadChildren: () => import('./pages/offtime/offtime-routes').then(m => m.OFFTIME_ROUTES) },
  { path: 'not-allowed', loadComponent: () => import('./pages/not-allowed').then(m => m.NotAllowedComponent) },
  { path: 'customers', loadChildren: () => import('./pages/customers/customer-routes').then(m => m.CUSTOMER_ROUTES)},
  { path: '**', redirectTo: '/' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {
    preloadingStrategy: PreloadAllModules
  })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
