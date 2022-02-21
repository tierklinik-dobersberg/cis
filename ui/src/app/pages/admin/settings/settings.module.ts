import { NgModule } from '@angular/core';
import { NzTableModule } from 'ng-zorro-antd/table';
import { SharedModule } from 'src/app/shared/shared.module';
import { SettingEditorComponent } from './setting-editor';
import { SettingTestComponent } from './setting-test';
import { SettingViewComponent } from './setting-view';
import { SettingsRoutingModule } from './settings-routing.module';

@NgModule({
  imports: [SharedModule, SettingsRoutingModule, NzTableModule],
  declarations: [
    SettingViewComponent,
    SettingEditorComponent,
    SettingTestComponent,
  ],
})
export class SettingsModule {}
