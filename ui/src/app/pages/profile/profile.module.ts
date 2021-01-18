import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { NzAvatarModule } from "ng-zorro-antd/avatar";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { ProfileComponent } from "./profile";
import { ProfileRoutingModule } from "./profile-routing.module";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzFormModule } from "ng-zorro-antd/form";
import { ReactiveFormsModule } from "@angular/forms";
import { ChangePasswordComponent } from "./change-password";
import { NzMessageServiceModule } from "ng-zorro-antd/message";
import { NzTagModule } from "ng-zorro-antd/tag";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";

@NgModule({
    imports: [
        CommonModule,
        ProfileRoutingModule,
        NzButtonModule,
        NzAvatarModule,
        NzIconModule,
        NzDescriptionsModule,
        NzInputModule,
        NzFormModule,
        NzTagModule,
        NzToolTipModule,
        ReactiveFormsModule,
        NzMessageServiceModule,
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