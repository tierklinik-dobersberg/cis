import { ScrollingModule } from '@angular/cdk/scrolling';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzListModule } from 'ng-zorro-antd/list';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopoverModule } from 'ng-zorro-antd/popover';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { SharedModule } from 'src/app/shared/shared.module';
import { CustomerListComponent } from './customer-list';
import { CustomerRoutingModule } from './customer-routing.module';
import { CustomerViewComponent } from './customer-view';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NzDescriptionsModule,
    NzListModule,
    NzSpinModule,
    NzTagModule,
    NzTabsModule,
    NzModalModule,
    NzDrawerModule,
    NzGridModule,
    NzPopoverModule,
    NgxChartsModule,
    ScrollingModule,
    CustomerRoutingModule,
    SharedModule,
  ],
  exports: [
    CustomerListComponent,
  ],
  declarations: [
    CustomerListComponent,
    CustomerViewComponent,
  ]
})
export class CustomerModule { }
