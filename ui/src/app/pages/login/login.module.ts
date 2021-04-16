import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { SharedModule } from 'src/app/shared/shared.module';
import { LoginComponent } from './login';
import { LoginRoutingModule } from './login-routing';

@NgModule({
    imports: [
        LoginRoutingModule,
        ReactiveFormsModule,
        NzFormModule,
        NzGridModule,
        SharedModule,
    ],
    declarations: [
        LoginComponent,
    ],
    exports: [
        LoginComponent
    ]
})
export class LoginModule { }
