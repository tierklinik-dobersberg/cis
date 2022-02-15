import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminOverviewComponent } from './admin';
import { ImportPageComponent } from './import';
import { ManageSettingsCategoryComponent } from './manage-settings-category';

const routes: Routes = [
  { path: '', component: AdminOverviewComponent },
  { path: 'import', component: ImportPageComponent },
  { path: 'identity', loadChildren: () => import("./users/users.module").then(m => m.UsersModule) },
  { path: 'config/category/:categoryName', component: ManageSettingsCategoryComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AdminRoutingModule { }
