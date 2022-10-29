import { NgModule } from "@angular/core";
import { Route, RouterModule } from "@angular/router";
import { TkdMyOffTimeRequestsComponent } from "./my-offtime-requests";
import { TkdOffTimeManagementComponent } from "./offtime-management";

const routes: Route[] = [
    { path: 'my-requests', component: TkdMyOffTimeRequestsComponent },
    { path: 'manage', component: TkdOffTimeManagementComponent },
];

@NgModule({
    imports: [
        RouterModule.forChild(routes),
    ]
})
export class TkdOfftimeRoutingModule {}