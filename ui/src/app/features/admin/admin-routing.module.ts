import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminOverviewComponent } from './admin';

const routes: Routes = [
  { path: '', component: AdminOverviewComponent },
  {
    path: 'settings',
    loadChildren: () => import('./settings').then((m) => m.SettingsModule),
  },
  {
    path: 'operations',
    loadComponent: () => import('./operations/operations.component').then(c => c.OperationsComponent)
  },
  { path: 'species', loadComponent: () => import('./species/species-list/species-list.component').then(m => m.SpeciesListComponent)},
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminRoutingModule {}
