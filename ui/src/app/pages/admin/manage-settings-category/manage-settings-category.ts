import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, TrackByFunction } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { NzMessageService } from "ng-zorro-antd/message";
import { forkJoin, of, Subject } from "rxjs";
import { map, switchMap, takeUntil } from "rxjs/operators";
import { ConfigAPI, Schema } from "src/app/api";

@Component({
  templateUrl: './manage-settings-category.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManageSettingsCategoryComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject();

  schemas: Schema[] = [];

  trackSchema: TrackByFunction<Schema> = (_: number, s: Schema) => s.name;

  constructor(
    private configAPI: ConfigAPI,
    private route: ActivatedRoute,
    private router: Router,
    private nzMessageService: NzMessageService,
    private cdr: ChangeDetectorRef
  ){}

  ngOnInit(): void {
     this.route.paramMap
      .pipe(
        map(params => params.get('categoryName')),
        switchMap(name => {
          return forkJoin({
            categoryName: of(name),
            schemas: this.configAPI.listSchemas(),
          })
        }),
        map(result => {
          return result.schemas.filter(schema => schema.category === result.categoryName)
        }),
        takeUntil(this.destroy$),
      )
      .subscribe(schemas => {
        this.schemas = schemas;
        this.cdr.markForCheck();
      })
  }

  ngOnDestroy(): void {
      this.destroy$.next()
      this.destroy$.complete();
  }
}

