import { NgModule } from '@angular/core';
import { CctvRoutingModule } from './cctv-routing.module';
import { SharedModule } from '../../shared/shared.module';
import { CameraListComponent } from './camera-list';

@NgModule({
  imports: [
    CctvRoutingModule,
    SharedModule,
  ],
  declarations: [
    CameraListComponent,
  ],
})
export class CctvModule { }
