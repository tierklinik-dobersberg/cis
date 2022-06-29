import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { NzMessageService } from "ng-zorro-antd/message";
import { combineLatest, forkJoin, Observable, of, Subject, switchMap, takeUntil } from "rxjs";
import { WikiAPI } from "src/app/api/wiki.api";
import { extractErrorMessage } from "src/app/utils";
import { CollectionModel, extendCollection } from "../utils";
import { WikiHelper } from "../wiki-helper";

@Component({
  selector: 'wiki-document-editor',
  templateUrl: './document-editor.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WikiDocumentEditorComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  /** The name of the collection this document is part of */
  collection: CollectionModel | null = null;

  /** The path of the document in the collection */
  path: string = '';

  /** Whether or not the user must still enter a path for the document */
  canEditPath: boolean = false;

  /** The markdown content of the document */
  content: string = '';

  /** The title of the document */
  title: string = '';

  /** The optional description of the document */
  description: string = '';

  /** The list of document tags. */
  tags: string[] = [];

  /** Whether or not this is a new document */
  isNewDocument: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private wiki: WikiAPI,
    private nzMessageService: NzMessageService,
    private helper: WikiHelper,
  ) {}

  saveOrCreate() {
    let path = this.path;
    if (path.length === 0) {
      // FIXME(ppacher): add actual validation so the user knows what's going on
      return;
    }

    // trim a path-separator prefix
    if (path[0] === '/') {
      path = path.substring(1);
    }

    // FIXME(ppacher): add better path validation here so stuff like "////../foo"  is not considered
    // valid.

    let op: Observable<any>;
    if (this.isNewDocument) {
      op = this.wiki.documents.create(
        this.collection.name,
        this.path,
        {
          content: this.content,
          description: this.description,
          title: this.title,
          owner: '',
          tags: this.tags,
        }
      )
    } else {
      // TODO(ppacher): we don't support changing the path, tags or document
      // ownership here yet
      op = this.wiki.documents.update(
        this.collection.name,
        this.path,
        {
          content: this.content,
          description: this.description,
          title: this.title,
          tags: this.tags,
        }
      )
    }

    op.subscribe({
      next: () => {
        this.nzMessageService.success("Dokument erfolgreich gespeichert");

        const path = ['/wiki/collection', this.collection.name];
        let fragment = null;
        if (this.path !== '/index') {
          fragment = this.path;
        }

        this.router.navigate(path, {fragment})
      },
      error: err => {
        this.nzMessageService.error(extractErrorMessage(err, 'Dokument konnte nicht gespeichert werden'))
      }
    })
  }

  ngOnInit(): void {
    combineLatest([
      this.route.paramMap,
      this.route.fragment,
    ])
      .pipe(
        takeUntil(this.destroy$),
        switchMap(([params, fragment]) => {
          let colname = params.get("name");
          return forkJoin({
            document: !!fragment ? this.wiki.documents.load(colname, fragment) : of(null),
            collection: this.wiki.collections.get(colname)
          })
        })
      )
      .subscribe(res => {
        this.collection = extendCollection(res.collection.collection);
        this.path = this.route.snapshot.fragment;
        if (this.path === null) {
          this.canEditPath = true;
          this.path = '';
        } else {
          this.canEditPath = false;
        }

        if (res.document?.document) {
          this.content = res.document.document.content ?? '';
          this.title = res.document.document.title;
          this.description = res.document.document.title;
          this.tags = res.document.document?.metadata.tags;
          this.isNewDocument = false;
        } else {
          this.content = '';
          this.title = '';
          this.description = '';
          this.isNewDocument = true;
          this.tags = [];
        }

        this.cdr.markForCheck();
      })
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
