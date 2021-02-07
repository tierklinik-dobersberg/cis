import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { VoiceMailComponent } from "./voicemail.component";

let routes: Routes = [
    { path: ':name', component: VoiceMailComponent },
]

@NgModule({
    imports: [
        RouterModule.forChild(routes),
    ],
    exports: [
        RouterModule
    ]
})
export class VoiceMailsRoutingModule { }