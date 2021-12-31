import { NgModule } from "@angular/core";
import { Router, RouterModule, Routes } from "@angular/router";
import { StatsPageComponent } from "./stats.component";

const routes: Routes = [
    { path: '', component: StatsPageComponent }
]

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class StatsRoutingModule {}
