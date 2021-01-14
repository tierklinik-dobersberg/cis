import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { LoginComponent } from "./login";

export const LoginRoutes: Routes = [
    { path: '', component: LoginComponent },
]

@NgModule({
    imports: [
        RouterModule.forChild(LoginRoutes),
    ],
    exports: [
        RouterModule,
    ]
})
export class LoginRoutingModule { }