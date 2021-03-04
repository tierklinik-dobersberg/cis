import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ChangePasswordComponent } from './change-password';
import { ProfileComponent } from './profile';

const routes: Routes = [
  { path: '', component: ProfileComponent },
  { path: 'change-password', component: ChangePasswordComponent }
];

@NgModule({
  imports: [
    RouterModule.forChild(routes)
  ],
  exports: [RouterModule]
})
export class ProfileRoutingModule { }
