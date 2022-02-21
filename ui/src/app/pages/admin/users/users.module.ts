import { NgModule } from '@angular/core';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzListModule } from 'ng-zorro-antd/list';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { ColorTwitterModule } from 'ngx-color/twitter';
import { SharedModule } from 'src/app/shared/shared.module';
import { CreateUserComponent } from './create-user';
import { PermissionsViewComponent } from './permissions-view';
import { RoleListComponent } from './role-list';
import { RoleViewComponent } from './role-view';
import { UserListComponent } from './user-list';
import { UsersRoutingModule } from './users-routing.module';

@NgModule({
  imports: [
    UsersRoutingModule,
    SharedModule,
    NzDescriptionsModule,
    NzListModule,
    NzSpinModule,
    NzGridModule,
    NzModalModule,
    NzTabsModule,
    ColorTwitterModule,
  ],
  declarations: [
    UserListComponent,
    CreateUserComponent,
    RoleListComponent,
    RoleViewComponent,
    PermissionsViewComponent,
  ],
})
export class UsersModule {}
