import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginRoutes } from './pages/login/login-routing';

const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: '/welcome' },
  { path: 'welcome', loadChildren: () => import('./pages/welcome/welcome.module').then(m => m.WelcomeModule) },
  { path: 'roster', loadChildren: () => import('./pages/roster/roster.module').then(m => m.RosterModule) },
  { path: 'login', children: LoginRoutes },
  { path: 'calllogs', loadChildren: () => import('./pages/calllogs/calllog.module').then(m => m.CallLogModule) },
  { path: 'xray', loadChildren: () => import('./pages/xray/xray.module').then(m => m.XRayModule) },
  { path: 'profile', loadChildren: () => import('./pages/profile/profile.module').then(m => m.ProfileModule) },
  { path: 'customer', loadChildren: () => import('./pages/customer/customer.module').then(m => m.CustomerModule) },
  { path: 'admin', loadChildren: () => import('./pages/admin/admin.module').then(m => m.AdminModule) },
  { path: 'voicemail', loadChildren: () => import('./pages/voicemails/voicemails.module').then(m => m.VoiceMailsModule) },
  { path: 'create-event', loadChildren: () => import('./pages/create-event/create-event.module').then(m => m.CreateEventModule) },
  { path: 'calendar', loadChildren: () => import('./pages/calendar/calendar.module').then(m => m.CalendarModule) },
  { path: 'cctv', loadChildren: () => import('./pages/cctv/cctv.module').then(m => m.CctvModule) },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
