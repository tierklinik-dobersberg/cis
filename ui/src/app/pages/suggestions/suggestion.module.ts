import { NgModule } from "@angular/core";
import { NzPopconfirmModule } from "ng-zorro-antd/popconfirm";
import { NzTagModule } from "ng-zorro-antd/tag";
import { SharedModule } from "src/app/shared/shared.module";
import { SuggestionCardComponent } from "./suggestion-card";

@NgModule({
  imports: [
    NzTagModule,
    SharedModule,
    NzPopconfirmModule,
  ],
  declarations: [
    SuggestionCardComponent,

  ]
})
export class SuggestionModule { }
