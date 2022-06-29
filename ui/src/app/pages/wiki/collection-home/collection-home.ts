import { HttpErrorResponse } from "@angular/common/http";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { NzMessageService } from "ng-zorro-antd/message";
import { catchError, combineLatest, forkJoin, map, of, Subject, switchMap, takeUntil } from "rxjs";
import { Backlink, Collection, Document, DocumentResponse, WikiAPI } from "src/app/api/wiki.api";
import { extractErrorMessage } from "src/app/utils";
import { CollectionModel, extendCollection } from "../utils";
import { WikiHelper } from "../wiki-helper";

@Component({
  templateUrl: './collection-home.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WikiCollectionHomeComponent implements OnInit, OnDestroy, DocumentResponse {
  /** Emits and completes when the component is destroyed */
  private destroy$ = new Subject<void>();

  /** The currently displayed collection */
  collection: CollectionModel | null = null;

  /** The root collection document */
  document?: Document;

  /** A list of backlinks that point to the root of the collection */
  backlinks?: Backlink[];

  /** A list of child documents in this collection */
  children?: Document[];

  /** The path of the current document. This is set to '' for /index document of a collection. */
  path: string = '';

  constructor(
    private wiki: WikiAPI,
    private helper: WikiHelper,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private nzMessageService: NzMessageService,
  ) {}

  ngOnInit(): void {
    combineLatest([this.route.paramMap, this.route.fragment])
      .pipe(
        takeUntil(this.destroy$),
        switchMap(([params, fragment]) => {
          const name = params.get("name")
          if (!name) {
            return of(null);
          }

          return this.wiki.collections.get(name)
            .pipe(
              map(res => res.collection),
              switchMap(col => {
                return forkJoin({
                  collection: of(col),
                  root: this.wiki.documents.load(col.name, fragment ?? "index", {recursive: true}),
                  children: !!fragment ? of(null) : this.wiki.documents.load(col.name, "/", {exclude: ['backlinks', 'document'], recursive: true})
                })
              }),
              catchError(err => {
                if (err instanceof HttpErrorResponse && err.status === 404) {
                  this.nzMessageService.error('Der Bereich ' + name + ' existiert nicht')
                } else {
                  this.nzMessageService.error(extractErrorMessage(err, 'Internal server error'))
                }

                this.router.navigate(['/wiki/start']);

                return of(null);
              })
            )
        }),
      )
      .subscribe(result => {
        if (!result) {
          return;
        }

        this.document = result.root.document;
        if (result.children === null) {
          this.children = result.root.children;
          this.backlinks = result.root.backlinks;
        } else {
          this.backlinks = result.children.backlinks ?? [];
          this.children = (result.children.children ?? []);
        }

        let fragment = this.route.snapshot.fragment;
        if (!!fragment && fragment.length > 0 && fragment[0] !== '/') {
          fragment = "/" + fragment
        }

        this.children = this.children.filter(child => child.path !== (fragment ?? '/index'))
        this.path = fragment ?? '';

        this.collection = extendCollection(result.collection);
        this.cdr.markForCheck();
      })
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
