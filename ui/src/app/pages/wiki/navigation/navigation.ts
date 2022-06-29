import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, TrackByFunction } from "@angular/core";
import { combineLatest, interval, startWith, Subject, switchMap, takeUntil } from "rxjs";
import { WikiAPI } from "src/app/api/wiki.api";
import { CollectionModel, extendCollection } from "../utils";
import { WikiHelper } from "../wiki-helper";

@Component({
  selector: 'wiki-nav',
  templateUrl: './navigation.html',
  styleUrls: ['./navigation.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WikiNavigationComponent implements OnInit, OnDestroy {
  /** emits when the component is destroyed. */
  private destroy$ = new Subject<void>();

  /** A list of all available collections */
  collections: CollectionModel[] = [];

  /** @private - track-by function for the list of collections */
  trackCollection: TrackByFunction<CollectionModel> = (_: number, col: CollectionModel) => col.name;

  constructor(
    private wiki: WikiAPI,
    private helper: WikiHelper,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    combineLatest([
      interval(5000).pipe(startWith(-1)),
      this.helper.collectionChange(),
    ])
      .pipe(
        takeUntil(this.destroy$),
        switchMap(() => this.wiki.collections.list()),
      )
      .subscribe(result => {
        this.collections = (result.collections ?? [])
          .map(col => extendCollection(col))
        this.cdr.markForCheck();
      })
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
