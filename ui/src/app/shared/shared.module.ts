import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { NzAvatarModule } from "ng-zorro-antd/avatar";
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzInputModule } from "ng-zorro-antd/input";
import { NzMessageServiceModule } from "ng-zorro-antd/message";
import { NzTableModule } from "ng-zorro-antd/table";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { MarkdownModule } from 'ngx-markdown';
import { CallLogTableComponent } from "./callog-table";
import { CommentComponent } from "./comment";
import { HeaderTitleOutlet } from "./header-title";
import { DurationPipe } from "./pipes";

@NgModule({
  imports: [
    NzTableModule,
    NzToolTipModule,
    NzIconModule,
    NzAvatarModule,
    NzMessageServiceModule,
    NzButtonModule,
    NzInputModule,
    MarkdownModule.forChild(),
    CommonModule,
    FormsModule,
    RouterModule,
  ],
  declarations: [
    DurationPipe,
    HeaderTitleOutlet,
    CallLogTableComponent,
    CommentComponent,
  ],
  exports: [
    DurationPipe,
    HeaderTitleOutlet,
    CommentComponent,
    CallLogTableComponent
  ]
})
export class SharedModule { }
