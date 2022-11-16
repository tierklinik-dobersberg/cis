import { NgModule, Type } from '@angular/core';
import { CanActivate, RouterModule, Routes } from '@angular/router';
import { UsersReadyGuard } from './guards';
import { LoginRoutes } from './pages/login/login-routing';

const canActivate: Type<CanActivate>[] = [
  UsersReadyGuard
]

const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: '/welcome' },
  { path: 'login', children: LoginRoutes },

  { canActivate, path: 'welcome', loadChildren: () => import('./pages/welcome/welcome.module').then(m => m.WelcomeModule) },
  { canActivate, path: 'roster', loadChildren: () => import('./pages/roster/roster.module').then(m => m.RosterModule) },
  { canActivate, path: 'roster2', loadChildren: () => import('./pages/roster2/roster2.module').then(m => m.TkdRoster2Module )},
  { canActivate, path: 'calllogs', loadChildren: () => import('./pages/calllogs/calllog.module').then(m => m.CallLogModule) },
  { canActivate, path: 'xray', loadChildren: () => import('./pages/xray/xray.module').then(m => m.XRayModule) },
  { canActivate, path: 'profile', loadChildren: () => import('./pages/profile/profile.module').then(m => m.ProfileModule) },
  { canActivate, path: 'customer', loadChildren: () => import('./pages/customer/customer.module').then(m => m.CustomerModule) },
  { canActivate, path: 'admin', loadChildren: () => import('./pages/admin/admin.module').then(m => m.AdminModule) },
  { canActivate, path: 'voicemail', loadChildren: () => import('./pages/voicemails/voicemails.module').then(m => m.VoiceMailsModule) },
  { canActivate, path: 'calendar', loadChildren: () => import('./pages/calendar/calendar.module').then(m => m.CalendarModule) },
  { canActivate, path: 'cctv', loadChildren: () => import('./pages/cctv/cctv.module').then(m => m.CctvModule) },
  { canActivate, path: 'infoscreen', loadChildren: () => import('./pages/infoscreen/infoscreen.module').then(m => m.InfoScreenModule) },
  { canActivate, path: 'statistics', loadChildren: () => import('./pages/stats/stats.module').then(m => m.StatsModule) },
  { canActivate, path: 'healthchecks', loadChildren: () => import('./pages/healthchecks/hc.module').then(m => m.HealthchecksModule) },
  { canActivate, path: 'wiki', loadChildren: () => import('./pages/wiki/wiki.module').then(m => m.WikiModule) },
  { canActivate, path: 'offtime', loadChildren: () => import('./pages/offtime/offtime.module').then(m => m.TkdOfftimeModule) },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
