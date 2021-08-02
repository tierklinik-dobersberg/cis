import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { ShowEditorComponent } from "./show-editor";
import { ShowListComponent } from "./showlist";

export const InfoScreenRoutes: Routes = [
  { path: '', component: ShowListComponent },
  { path: 'edit/:show', component: ShowEditorComponent }
]

@NgModule({
  imports: [
    RouterModule.forChild(InfoScreenRoutes),
  ],
  exports: [
    RouterModule
  ]
})
export class InfoScreenRoutingModule { }
