import { ChangeDetectionStrategy, Component, Input } from "@angular/core";
import { Backlink } from "src/app/api/wiki.api";
import { CollectionModel } from "../utils";

@Component({
  selector: 'wiki-backlink-list',
  templateUrl: './backlink-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WikiBacklinkListComponent {
  @Input()
  collection?: CollectionModel;

  @Input()
  backlinks: Backlink[] = [];
}
