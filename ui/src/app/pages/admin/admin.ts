import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  TrackByFunction,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { HlmButtonDirective } from '@tierklinik-dobersberg/angular/button';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ConfigAPI, Schema } from 'src/app/api';
import { HeaderTitleService } from 'src/app/layout/header-title';

interface Category {
  name: string;
  schemas: Schema[];
}

@Component({
  templateUrl: './admin.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    NzToolTipModule,
    RouterLink,
    HlmButtonDirective
  ]
})
export class AdminOverviewComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  categories: Category[] = [];

  trackSchema: TrackByFunction<Schema> = (_: number, s: Schema) => s.name;
  trackCategory: TrackByFunction<Category> = (_: number, s: Category) => s.name;

  constructor(
    private headerTitleService: HeaderTitleService,
    private configAPI: ConfigAPI,
    public dom: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.headerTitleService.set(
      'Administration',
      'Willkommen in der System-Administration.'
    );

    this.configAPI
      .listSchemas()
      .pipe(takeUntil(this.destroy$))
      .subscribe((schemas) => {
        let categories = new Map<string, Schema[]>();
        let global: Schema[] = [];

        this.categories = [];

        schemas.forEach((s) => {
          if (!!s.category) {
            let cat = categories.get(s.category) || [];
            cat.push(s);
            categories.set(s.category, cat);
            return;
          }

          global.push(s);
        });

        this.categories.push({
          name: 'Allgemein',
          schemas: global,
        });

        categories.forEach((val, key) =>
          this.categories.push({
            name: key,
            schemas: val,
          })
        );
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
