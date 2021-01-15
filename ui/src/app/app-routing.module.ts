import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { LoginRoutes } from './pages/login/login-routing';
import { LoginModule } from './pages/login/login.module';
import { WelcomeComponent } from './pages/welcome/welcome.component';

const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: '/welcome' },
  { path: 'welcome', loadChildren: () => import('./pages/welcome/welcome.module').then(m => m.WelcomeModule) },
  { path: 'roster', loadChildren: () => import('./pages/roster/roster.module').then(m => m.RosterModule) },
  { path: 'login', children: LoginRoutes },
  { path: 'calllogs', loadChildren: () => import('./pages/calllogs/calllog.module').then(m => m.CallLogModule) },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
