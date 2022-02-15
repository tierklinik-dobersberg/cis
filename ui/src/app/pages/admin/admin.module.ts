import { NgModule } from '@angular/core';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzListModule } from 'ng-zorro-antd/list';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { SharedModule } from 'src/app/shared/shared.module';
import { AdminOverviewComponent } from './admin';
import { AdminRoutingModule } from './admin-routing.module';
import { ImportPageComponent } from './import';
import { ManageSettingsCategoryComponent } from './manage-settings-category';

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
        AdminOverviewComponent,
        ManageSettingsCategoryComponent,
    ],
    exports: [
        ImportPageComponent,
    ]
})
export class AdminModule { }
