import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { CKEditorModule } from "@ckeditor/ckeditor5-angular";
import { MarkdownModule, MarkedOptions } from "ngx-markdown";
import { SharedModule } from "src/app/shared/shared.module";
import { WikiBacklinkListComponent } from "./backlink-list";
import { WikiChildrenListComponent } from "./children-list";
import { WikiCollectionHomeComponent } from "./collection-home";
import { WikiCreateCollectionComponent } from "./create-collection";
import { WikiDocumentEditorComponent } from "./document-editor";
import { WikiDocumentMetadataComponent } from "./document-metadata/document-metadata";
import { WikiDocumentPathComponent } from "./document-path";
import { WikiDocumentRendererComponent } from "./document-renderer";
import { WikiDocumentSearchComponent } from "./document-search";
import { WikiNavigationComponent } from "./navigation";
import { SplitPathPipe } from "./split-path.pipe";
import { WikiStartPageComponent } from "./start-page";
import { WikiHelper } from "./wiki-helper";
import { WikiRoutingModule } from "./wiki-routing.module";

@NgModule({
  imports: [
    SharedModule,
    CommonModule,
    WikiRoutingModule,
    CKEditorModule,
    MarkdownModule.forRoot({
      markedOptions: {
        provide: MarkedOptions,
        useValue: <MarkedOptions>{
          baseUrl: '/wiki/collection/'
        }
      }
    }),
  ],
  declarations: [
    WikiNavigationComponent,
    WikiStartPageComponent,
    WikiCreateCollectionComponent,
    WikiCollectionHomeComponent,
    WikiDocumentPathComponent,
    WikiDocumentRendererComponent,
    WikiDocumentEditorComponent,
    WikiChildrenListComponent,
    WikiBacklinkListComponent,
    WikiDocumentMetadataComponent,
    WikiDocumentSearchComponent,
    SplitPathPipe,
  ],
  exports: [
    WikiNavigationComponent,
  ],
  providers: [
    WikiHelper
  ]
})
export class WikiModule {}
