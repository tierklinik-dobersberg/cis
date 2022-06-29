import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from "@angular/core";
import { debounceTime, Subject, switchMap, takeUntil } from "rxjs";
import { Document, WikiAPI } from "src/app/api/wiki.api";

@Component({
  selector: 'wiki-document-search',
  templateUrl: './document-search.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WikiDocumentSearchComponent implements OnInit, OnDestroy {
  searchTerm: string = '';
  documents: Document[] = [];

  private search$ = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(
    private wiki: WikiAPI,
    private cdr: ChangeDetectorRef,
  ) {}

  triggerSearch() {
    this.search$.next(this.searchTerm);
  }

  ngOnInit(): void {
    this.search$
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(100),
        switchMap(term => this.wiki.documents.search(term))
      )
      .subscribe(result => {
        this.documents = result.results;
        this.cdr.markForCheck();
      })
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

