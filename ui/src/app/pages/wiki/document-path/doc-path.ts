import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import { CollectionModel } from "../utils";

@Component({
  selector: 'wiki-doc-path',
  templateUrl: './doc-path.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WikiDocumentPathComponent {
  /** The collection the document path belongs to */
  @Input()
  collection: CollectionModel | null = null;

  /** Input for the document path that should be displayed */
  @Input()
  path: string;
}
