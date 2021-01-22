import { ScrollingModule } from "@angular/cdk/scrolling";
import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzDescriptionsModule } from "ng-zorro-antd/descriptions";
import { NzEmptyModule } from "ng-zorro-antd/empty";
import { NzGridModule } from "ng-zorro-antd/grid";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzListModule } from "ng-zorro-antd/list";
import { NzMessageServiceModule } from "ng-zorro-antd/message";
import { NzSpinModule } from "ng-zorro-antd/spin";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { CustomerListComponent } from "./customer-list";
import { CustomerRoutingModule } from "./customer-routing.module";
import { CustomerViewComponent } from "./customer-view";

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
        NzIconModule,
        NzSpinModule,
        NzEmptyModule,
        NzGridModule,
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