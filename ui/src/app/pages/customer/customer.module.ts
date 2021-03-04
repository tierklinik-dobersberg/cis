import { ScrollingModule } from '@angular/cdk/scrolling';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzListModule } from 'ng-zorro-antd/list';
import { NzMessageServiceModule } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { SharedModule } from 'src/app/shared/shared.module';
import { CustomerListComponent } from './customer-list';
import { CustomerRoutingModule } from './customer-routing.module';
import { CustomerViewComponent } from './customer-view';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    NzDescriptionsModule,
    NzInputModule,
    NzButtonModule,
    NzToolTipModule,
    NzMessageServiceModule,
    NzListModule,
    NzCheckboxModule,
    NzIconModule,
    NzSpinModule,
    NzTagModule,
    NzTabsModule,
    NzModalModule,
    NzDrawerModule,
    NzTableModule,
    NzEmptyModule,
    NzGridModule,
    NgxChartsModule,
    SharedModule,
    ScrollingModule,
    CustomerRoutingModule,
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
