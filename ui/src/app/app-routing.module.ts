import { NgModule, Type } from '@angular/core';
import { CanActivateFn, RouterModule, Routes } from '@angular/router';
import { ComputerAccountGuard, UsersReadyGuard } from './guards';
import { NotAllowedComponent } from './pages/not-allowed';

const canActivate: Type<{
    canActivate: CanActivateFn;
}>[] = [
  UsersReadyGuard
]

const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: '/welcome' },
  { canActivate, path: 'welcome', loadChildren: () => import('./pages/welcome/welcome.module').then(m => m.WelcomeModule) },
  { canActivate, path: 'on-call', loadChildren: () => import('./pages/on-call-overwrite/on-call-overwrite.module').then(m => m.OnCallOverwriteModule) },
  { canActivate, path: 'calllogs', loadChildren: () => import('./pages/calllogs/calllog.module').then(m => m.CallLogModule) },
  { canActivate, path: 'customer', loadChildren: () => import('./pages/customer/customer.module').then(m => m.CustomerModule) },
  { canActivate, path: 'admin', loadChildren: () => import('./pages/admin/admin.module').then(m => m.AdminModule) },
  { canActivate, path: 'voicemail', loadChildren: () => import('./pages/voicemails/voicemails.module').then(m => m.VoiceMailsModule) },
  //{ canActivate, path: 'calendar', loadChildren: () => import('./pages/calendar/calendar.module').then(m => m.CalendarModule) },
  { canActivate, path: 'calendar', loadComponent: () => import('./pages/calendar2/calendar-view/calendar-view.component').then(m => m.TkdCalendarViewComponent) },
  { canActivate, path: 'roster', loadChildren: () => import('./pages/roster/roster.module').then(m => m.RosterModule) },
  { canActivate: [ComputerAccountGuard], path: 'offtime', loadChildren: () => import('./pages/offtime/offtime-routes').then(m => m.OFFTIME_ROUTES) },
  { path: 'not-allowed', component: NotAllowedComponent },
  { path: '**', redirectTo: '/welcome' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
