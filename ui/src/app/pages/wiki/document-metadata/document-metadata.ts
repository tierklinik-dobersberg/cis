import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import { Document } from "src/app/api/wiki.api";

@Component({
  selector: 'wiki-document-metadata',
  templateUrl: './document-metadata.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WikiDocumentMetadataComponent {
  @Input()
  document: Document;
}
