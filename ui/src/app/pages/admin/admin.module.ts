import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { NzAvatarModule } from "ng-zorro-antd/avatar";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";
import { NzDescriptionsModule } from "ng-zorro-antd/descriptions";
import { NzEmptyModule } from "ng-zorro-antd/empty";
import { NzGridModule } from "ng-zorro-antd/grid";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzListModule } from "ng-zorro-antd/list";
import { NzMessageServiceModule } from "ng-zorro-antd/message";
import { NzSpinModule } from "ng-zorro-antd/spin";
import { NzTableModule } from "ng-zorro-antd/table";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { AdminRoutingModule } from "./admin-routing.module";
import { ImportPageComponent } from "./import";
import { UserListComponent } from "./users";

@NgModule({
    imports: [
        AdminRoutingModule,
        CommonModule,
        FormsModule,
        NzDescriptionsModule,
        NzInputModule,
        NzButtonModule,
        NzToolTipModule,
        NzMessageServiceModule,
        NzListModule,
        NzCheckboxModule,
        NzIconModule,
        NzSpinModule,
        NzEmptyModule,
        NzTableModule,
        NzAvatarModule,
        NzGridModule,
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