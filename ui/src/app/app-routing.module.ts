import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./features/welcome/welcome.component').then(m => m.WelcomeComponent) },
  { path: 'on-call', loadComponent: () => import('./features/on-call-overwrite/overwrite-overview').then(m => m.OverwriteOverviewComponent) },
  { path: 'calllogs', loadComponent: () => import('./features/calllogs/calllog').then(m => m.CallLogComponent) },
  { path: 'admin', loadChildren: () => import('./features/admin/admin.module').then(m => m.AdminModule) },
  { path: 'voicemail/:name', loadComponent: () => import('./features/voicemails/voicemail.component').then(m => m.VoiceMailComponent) },
  { path: 'calendar', loadComponent: () => import('./features/calendar2/calendar-view/calendar-view.component').then(m => m.TkdCalendarViewComponent) },
  { path: 'offtime', loadChildren: () => import('./features/offtime/offtime-routes').then(m => m.OFFTIME_ROUTES) },
  { path: 'not-allowed', loadComponent: () => import('./features/not-allowed').then(m => m.NotAllowedComponent) },
  { path: 'customers', loadChildren: () => import('./features/customers/customer-routes').then(m => m.CUSTOMER_ROUTES)},
  { path: 'roster', loadComponent: () => import('./features/roster/roster.component').then(m => m.RosterComponent)},
  { path: 'tasks/:boardId', loadComponent: () => import('./features/tasks/task-list/tasks-list.component').then(m => m.TaskListComponent) },
  { path: 'board/:boardId', loadComponent: () => import('./features/tasks/manage-board/manage-board').then(m => m.ManageBoardComponent)},
  { path: 'board', loadComponent: () => import('./features/tasks/manage-board/manage-board').then(m => m.ManageBoardComponent)},
  { path: 'dicom', loadComponent: () => import('./features/dicom/dicom-overview').then(m => m.DicomOverviewComponent)},
  { path: '**', redirectTo: '/' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {
    preloadingStrategy: PreloadAllModules
  })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
