import { NgModule } from "@angular/core";
import { Route, RouterModule } from "@angular/router";
import { ManageSettingsCategoryComponent } from "./category-view";
import { SettingViewComponent } from "./setting-view";

const routes: Route[] = [
  { path: ':name', component: SettingViewComponent },
  { path: 'category/:categoryName', component: ManageSettingsCategoryComponent },
]

@NgModule({
  imports: [
    RouterModule.forChild(routes),
  ],
  exports: [
    RouterModule
  ]
})
export class SettingsRoutingModule {}
