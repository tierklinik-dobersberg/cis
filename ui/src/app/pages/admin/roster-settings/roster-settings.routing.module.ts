import { NgModule } from "@angular/core";
import { Route, RouterModule } from "@angular/router";
import { TkdRosterSettingsComponent } from "./roster-settings";

const routes: Route[] = [
    { path: '', component: TkdRosterSettingsComponent }
]

@NgModule({
    imports: [
        RouterModule.forChild(routes),
    ]
})
export class TkdRosterSettingsRoutingModule {}
