import { DragDropModule } from "@angular/cdk/drag-drop";
import { NgModule } from "@angular/core";
import { NzCollapseModule } from 'ng-zorro-antd/collapse';
import { ColorTwitterModule } from 'ngx-color/twitter';
import { SharedModule } from "src/app/shared/shared.module";
import { InfoScreenRoutingModule } from "./infoscreen-routing.module";
import { LayoutVariableInputComponent } from "./editor-input";
import { ShowEditorComponent } from "./show-editor";
import { ShowListComponent } from "./showlist";

@NgModule({
  imports: [
    InfoScreenRoutingModule,
    SharedModule,
    NzCollapseModule,
    DragDropModule,
    ColorTwitterModule,
  ],
  declarations: [
    ShowListComponent,
    ShowEditorComponent,
    LayoutVariableInputComponent,
  ],
  exports: [],
})
export class InfoScreenModule { }
