import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { ComputerAccountGuard } from './guards';
import { NotAllowedComponent } from './pages/not-allowed';

const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./pages/welcome/welcome.component').then(m => m.WelcomeComponent) },
  { path: 'on-call', loadChildren: () => import('./pages/on-call-overwrite/on-call-overwrite-routing.module').then(m => m.routes) },
  { path: 'test', loadComponent: () => import("./pages/on-call-overwrite/overwrite-overview").then(m => m.OverwriteOverviewComponent )},
  { path: 'calllogs', loadComponent: () => import('./pages/calllogs/calllog').then(m => m.CallLogComponent) },
  { path: 'customer', loadChildren: () => import('./pages/customer/customer.module').then(m => m.CustomerModule) },
  { path: 'admin', loadChildren: () => import('./pages/admin/admin.module').then(m => m.AdminModule) },
  { path: 'voicemail/:name', loadComponent: () => import('./pages/voicemails/voicemail.component').then(m => m.VoiceMailComponent) },
  { path: 'calendar', loadComponent: () => import('./pages/calendar2/calendar-view/calendar-view.component').then(m => m.TkdCalendarViewComponent) },
  { path: 'roster', loadChildren: () => import('./pages/roster/roster.module').then(m => m.RosterModule) },
  { canActivate: [ComputerAccountGuard], path: 'offtime', loadChildren: () => import('./pages/offtime/offtime-routes').then(m => m.OFFTIME_ROUTES) },
  { path: 'not-allowed', component: NotAllowedComponent },
  { path: '**', redirectTo: '/' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {
    preloadingStrategy: PreloadAllModules
  })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
