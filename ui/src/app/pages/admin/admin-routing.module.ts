import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { ImportPageComponent } from "./import";
import { UserListComponent } from "./users";

var routes: Routes = [
    { path: 'import', component: ImportPageComponent },
    { path: 'users', component: UserListComponent },
]

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class AdminRoutingModule { void }