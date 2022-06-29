import { NgModule } from '@angular/core';
import { Route, RouterModule } from '@angular/router';
import { WikiCollectionHomeComponent } from './collection-home';
import { WikiCreateCollectionComponent } from './create-collection';
import { WikiDocumentEditorComponent } from './document-editor';
import { WikiDocumentSearchComponent } from './document-search';
import { WikiStartPageComponent } from './start-page';

const routes: Route[] = [
  { path: 'start', component: WikiStartPageComponent },
  { path: 'search', component: WikiDocumentSearchComponent },
  { path: '', pathMatch: 'full', redirectTo: 'start' },
  { path: 'collection/new', pathMatch: 'full', component: WikiCreateCollectionComponent },
  { path: 'collection/:name', component: WikiCollectionHomeComponent },
  { path: 'edit/document/:name', component: WikiDocumentEditorComponent }
];

@NgModule({
  imports: [
    RouterModule.forChild(routes),
  ],
  exports: [
    RouterModule,
  ]
})
export class WikiRoutingModule {}
