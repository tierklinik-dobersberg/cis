import { NgModule } from "@angular/core";
import { SharedModule } from "src/app/shared/shared.module";
import { InfoScreenRoutingModule } from "./infoscreen-routing.module";
import { ShowEditorComponent } from "./show-editor";
import { ShowListComponent } from "./showlist";
import { CKEditorModule } from '@ckeditor/ckeditor5-angular';
import { NzSelectModule } from "ng-zorro-antd/select";
import { DragDropModule } from "@angular/cdk/drag-drop";

@NgModule({
  imports: [
    InfoScreenRoutingModule,
    SharedModule,
    CKEditorModule,
    NzSelectModule,
    DragDropModule,
  ],
  declarations: [
    ShowListComponent,
    ShowEditorComponent,
  ],
  exports: [],
})
export class InfoScreenModule { }
