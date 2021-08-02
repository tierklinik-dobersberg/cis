import { NgModule } from "@angular/core";
import { SharedModule } from "src/app/shared/shared.module";
import { InfoScreenRoutingModule } from "./infoscreen-routing.module";
import { ShowEditorComponent } from "./show-editor";
import { ShowListComponent } from "./showlist";

@NgModule({
  imports: [
    InfoScreenRoutingModule,
    SharedModule,
  ],
  declarations: [
    ShowListComponent,
    ShowEditorComponent,
  ],
  exports: [],
})
export class InfoScreenModule { }
