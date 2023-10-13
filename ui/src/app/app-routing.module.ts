import { NgModule, Type } from '@angular/core';
import { CanActivate, RouterModule, Routes } from '@angular/router';
import { UsersReadyGuard } from './guards';

const canActivate: Type<CanActivate>[] = [
  UsersReadyGuard
]

const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: '/welcome' },
  { canActivate, path: 'welcome', loadChildren: () => import('./pages/welcome/welcome.module').then(m => m.WelcomeModule) },
  { canActivate, path: 'on-call', loadChildren: () => import('./pages/on-call-overwrite/on-call-overwrite.module').then(m => m.OnCallOverwriteModule) },
  { canActivate, path: 'calllogs', loadChildren: () => import('./pages/calllogs/calllog.module').then(m => m.CallLogModule) },
  { canActivate, path: 'xray', loadChildren: () => import('./pages/xray/xray.module').then(m => m.XRayModule) },
  { canActivate, path: 'customer', loadChildren: () => import('./pages/customer/customer.module').then(m => m.CustomerModule) },
  { canActivate, path: 'admin', loadChildren: () => import('./pages/admin/admin.module').then(m => m.AdminModule) },
  { canActivate, path: 'voicemail', loadChildren: () => import('./pages/voicemails/voicemails.module').then(m => m.VoiceMailsModule) },
  { canActivate, path: 'calendar', loadChildren: () => import('./pages/calendar/calendar.module').then(m => m.CalendarModule) },
  { canActivate, path: 'cctv', loadChildren: () => import('./pages/cctv/cctv.module').then(m => m.CctvModule) },
  { canActivate, path: 'infoscreen', loadChildren: () => import('./pages/infoscreen/infoscreen.module').then(m => m.InfoScreenModule) },
  { canActivate, path: 'statistics', loadChildren: () => import('./pages/stats/stats.module').then(m => m.StatsModule) },
  { canActivate, path: 'healthchecks', loadChildren: () => import('./pages/healthchecks/hc.module').then(m => m.HealthchecksModule) },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
