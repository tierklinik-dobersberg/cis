import { NgModule } from '@angular/core';
import { Route, RouterModule } from '@angular/router';
import { ManageUserComponent } from './manage-user';
import { RoleListComponent } from './role-list';
import { RoleViewComponent } from './role-view';
import { UserListComponent } from './user-list';

let routes: Route[] = [
  {path: 'users', component: UserListComponent},
  {path: 'users/create', component: ManageUserComponent},
  {path: 'users/edit/:username', component: ManageUserComponent},

  {path: 'roles', component: RoleListComponent},
  {path: 'roles/create', component: RoleViewComponent},
  {path: 'roles/edit/:role', component: RoleViewComponent}
];

@NgModule({
  imports: [
    RouterModule.forChild(routes),
  ],
  exports: [
    RouterModule,
  ]
})
export class UsersRoutingModule {}
