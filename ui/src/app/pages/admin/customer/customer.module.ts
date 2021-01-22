import { ScrollingModule } from "@angular/cdk/scrolling";
import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzEmptyModule } from "ng-zorro-antd/empty";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzListModule } from "ng-zorro-antd/list";
import { NzMessageServiceModule } from "ng-zorro-antd/message";
import { NzSpinModule } from "ng-zorro-antd/spin";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { CustomerListComponent } from "./customer-list";
import { CustomerRoutingModule } from "./customer-routing.module";

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        NzInputModule,
        NzButtonModule,
        NzToolTipModule,
        NzMessageServiceModule,
        NzListModule,
        NzIconModule,
        NzSpinModule,
        NzEmptyModule,
        ScrollingModule,
        CustomerRoutingModule,
    ],
    exports: [
        CustomerListComponent,
    ],
    declarations: [
        CustomerListComponent,
    ]
})
export class CustomerModule { }