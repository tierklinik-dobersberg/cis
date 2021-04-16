import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { SharedModule } from 'src/app/shared/shared.module';
import { ChangePasswordComponent } from './change-password';
import { ProfileComponent } from './profile';
import { ProfileRoutingModule } from './profile-routing.module';

@NgModule({
    imports: [
        ProfileRoutingModule,
        NzDescriptionsModule,
        NzFormModule,
        NzTagModule,
        ReactiveFormsModule,
        SharedModule,
    ],
    exports: [
        ProfileComponent
    ],
    declarations: [
        ProfileComponent,
        ChangePasswordComponent,
    ]
})
export class ProfileModule { }
