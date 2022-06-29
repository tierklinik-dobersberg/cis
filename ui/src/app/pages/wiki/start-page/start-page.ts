import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from "@angular/core";
import { Collection, Document, WikiAPI } from "src/app/api/wiki.api";

@Component({
  templateUrl: './start-page.html',
  styleUrls: ['../wiki-markdown.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WikiStartPageComponent implements OnInit {
  recentlyUpdated: Document[] = [];

  collections: Collection[] = [];

  constructor(
    private wiki: WikiAPI,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.wiki.collections.list()
      .subscribe(collections => {
        this.collections = collections.collections;
        this.cdr.markForCheck();
      })

    this.wiki.documents.recentlyUpdated()
      .subscribe(result => {
        this.recentlyUpdated = result.results || [];
        this.cdr.markForCheck();
      })
  }
}
