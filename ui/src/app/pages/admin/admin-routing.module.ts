import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { ImportPageComponent } from "./import";

var routes: Routes = [
    { path: 'import', component: ImportPageComponent }
]

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class AdminRoutingModule { void }