import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ViewerComponent } from './viewer';
import { XRayComponent } from './xray';

const routes: Routes = [
    { path: '', component: XRayComponent },
    { path: 'viewer/:studyID/:seriesID/:instanceID', component: ViewerComponent }
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class XRayRoutingModule { }
