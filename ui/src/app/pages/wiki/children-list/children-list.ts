import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import { Document } from "src/app/api/wiki.api";
import { CollectionModel } from "../utils";

@Component({
  selector: 'wiki-children-list',
  templateUrl: './children-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WikiChildrenListComponent {
  @Input()
  collection?: CollectionModel;

  @Input()
  children: Document[] = [];
}
