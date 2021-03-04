import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageServiceModule } from 'ng-zorro-antd/message';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { LoginComponent } from './login';
import { LoginRoutingModule } from './login-routing';

@NgModule({
    imports: [
        LoginRoutingModule,
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        NzButtonModule,
        NzFormModule,
        NzToolTipModule,
        NzInputModule,
        NzMessageServiceModule,
        NzIconModule,
        NzGridModule,
        NzCheckboxModule,
    ],
    declarations: [
        LoginComponent,
    ],
    exports: [
        LoginComponent
    ]
})
export class LoginModule { }
