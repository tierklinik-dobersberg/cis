import { NgModule } from '@angular/core';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzListModule } from 'ng-zorro-antd/list';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { SharedModule } from 'src/app/shared/shared.module';
import { AdminRoutingModule } from './admin-routing.module';
import { ImportPageComponent } from './import';
import { UserListComponent } from './users';

@NgModule({
    imports: [
        AdminRoutingModule,
        NzDescriptionsModule,
        NzListModule,
        NzSpinModule,
        NzGridModule,
        SharedModule,
    ],
    declarations: [
        ImportPageComponent,
        UserListComponent,
    ],
    exports: [
        ImportPageComponent,
        UserListComponent,
    ]
})
export class AdminModule { }
