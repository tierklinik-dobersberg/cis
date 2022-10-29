import { NgModule } from "@angular/core";
import { NzTabsModule } from "ng-zorro-antd/tabs";
import { SharedModule } from "src/app/shared/shared.module";
import { TkdRosterSettingsComponent } from "./roster-settings";
import { TkdRosterSettingsRoutingModule } from "./roster-settings.routing.module";

@NgModule({
    imports: [
        SharedModule,
        NzTabsModule,
        TkdRosterSettingsRoutingModule
    ],
    declarations: [
        TkdRosterSettingsComponent,
    ],
    exports: [
        TkdRosterSettingsComponent
    ]
})
export class TkdRosterSettingsModule {}