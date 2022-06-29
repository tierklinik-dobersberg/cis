import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import { Document, WikiAPI } from "src/app/api/wiki.api";
import { CollectionModel } from "../utils";
import { WikiHelper } from "../wiki-helper";

@Component({
  selector: 'wiki-document-renderer',
  templateUrl: './document-renderer.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WikiDocumentRendererComponent {
  @Input()
  path?: string;

  @Input()
  document?: Document;

  @Input()
  collection?: CollectionModel;

  constructor(
    private wikiapi: WikiAPI,
    private wikiHelper: WikiHelper,
  ) {}
}
