import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, TrackByFunction } from "@angular/core";
import { DomSanitizer } from "@angular/platform-browser";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";
import { ConfigAPI, Schema } from "src/app/api";
import { HeaderTitleService } from "src/app/shared/header-title";

type SchemaOrCategory = Schema | { categoryName: string; description: '' }

@Component({
  templateUrl: './admin.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminOverviewComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  schemas: SchemaOrCategory[] = [];

  isCategory(s: SchemaOrCategory): s is {categoryName: string; description: ''} {
    return 'categoryName' in s;
  }

  trackSchema: TrackByFunction<SchemaOrCategory> = (_: number, s: SchemaOrCategory) => {
    if ('name' in s) {
      return s.name;
    }
    return s.categoryName;
  };

  constructor(
    private headerTitleService: HeaderTitleService,
    private configAPI: ConfigAPI,
    public dom: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.headerTitleService.set("Administration", "Willkommen in der System-Administration.");

    this.configAPI.listSchemas()
      .pipe(
        takeUntil(this.destroy$),
      )
      .subscribe(schemas => {
        let categories = new Set<string>();
        this.schemas = [];

        schemas.forEach(s => {
          if (!!s.category) {
            categories.add(s.category)
            return;
          }

          this.schemas.push(s)
        })

        categories.forEach(val => this.schemas.push({categoryName: val, description: ''}))
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
