import { NgModule } from '@angular/core';
import { RouterModule, Route } from '@angular/router';
import { DayViewComponent } from './day-view';

const routes: Route[] = [
    { path: '', component: DayViewComponent }
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class CalendarRoutingModule { }