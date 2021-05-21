import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CameraListComponent } from './camera-list';
import { CameraViewComponent } from './camera-view';

const routes: Routes = [
  { path: '', component: CameraListComponent },
  { path: ':camera', component: CameraViewComponent }
];

@NgModule({
  imports: [
    RouterModule.forChild(routes),
  ],
  exports: [RouterModule]
})
export class CctvRoutingModule { }
