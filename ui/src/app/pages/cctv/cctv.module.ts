import { NgModule } from '@angular/core';
import { CctvRoutingModule } from './cctv-routing.module';
import { SharedModule } from '../../shared/shared.module';
import { CameraListComponent } from './camera-list';
import { NzImageModule } from 'ng-zorro-antd/image';
import { CameraViewComponent } from './camera-view';

@NgModule({
  imports: [
    CctvRoutingModule,
    SharedModule,
    NzImageModule,
  ],
  declarations: [
    CameraListComponent,
    CameraViewComponent,
  ],
})
export class CctvModule { }
