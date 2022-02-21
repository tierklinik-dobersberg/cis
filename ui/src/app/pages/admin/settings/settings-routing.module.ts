import { NgModule } from '@angular/core';
import { Route, RouterModule } from '@angular/router';
import { SettingViewComponent } from './setting-view';

const routes: Route[] = [
  { path: ':name', component: SettingViewComponent },
  { path: ':name/:sid', component: SettingViewComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SettingsRoutingModule {}
