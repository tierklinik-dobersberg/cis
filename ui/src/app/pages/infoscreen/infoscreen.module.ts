import { NgModule } from "@angular/core";
import { SharedModule } from "src/app/shared/shared.module";
import { InfoScreenRoutingModule } from "./infoscreen-routing.module";
import { ShowEditorComponent } from "./show-editor";
import { ShowListComponent } from "./showlist";
import { CKEditorModule } from '@ckeditor/ckeditor5-angular';
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzCollapseModule } from 'ng-zorro-antd/collapse';
import { DragDropModule } from "@angular/cdk/drag-drop";
import { ColorTwitterModule } from 'ngx-color/twitter';

@NgModule({
  imports: [
    InfoScreenRoutingModule,
    SharedModule,
    CKEditorModule,
    NzSelectModule,
    NzCollapseModule,
    DragDropModule,
    ColorTwitterModule,
  ],
  declarations: [
    ShowListComponent,
    ShowEditorComponent,
  ],
  exports: [],
})
export class InfoScreenModule { }
