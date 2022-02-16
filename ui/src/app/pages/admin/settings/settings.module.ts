import { NgModule } from "@angular/core";
import { SharedModule } from "src/app/shared/shared.module";
import { ManageSettingsCategoryComponent } from "./category-view";
import { SettingEditorComponent } from "./setting-editor";
import { SettingViewComponent } from "./setting-view";
import { SettingsRoutingModule } from "./settings-routing.module";

@NgModule({
  imports: [
    SharedModule,
    SettingsRoutingModule,
  ],
  declarations: [
    ManageSettingsCategoryComponent,
    SettingViewComponent,
    SettingEditorComponent
  ]
})
export class SettingsModule {}
