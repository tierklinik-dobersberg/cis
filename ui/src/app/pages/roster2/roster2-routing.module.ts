import { NgModule } from '@angular/core';
import { Route, RouterModule } from '@angular/router';
import { TkdRoster2Component } from './roster2.component';


const routes: Route[] = [
  { path: '', component: TkdRoster2Component }
]

@NgModule({
  imports: [
    RouterModule.forChild(routes)
  ]
})
export class TkdRoster2Routing {}
