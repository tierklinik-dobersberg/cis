import { KeyValue, KeyValuePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  TrackByFunction,
  ViewChild,
} from '@angular/core';
import { FormsModule, NgModel } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HlmButtonDirective } from '@tierklinik-dobersberg/angular/button';
import { HlmDialogService } from '@tierklinik-dobersberg/angular/dialog';
import { HlmTableModule } from '@tierklinik-dobersberg/angular/table';
import { toast } from 'ngx-sonner';
import {
  BehaviorSubject,
  combineLatest,
  forkJoin,
  Observable,
  of,
  Subject,
} from 'rxjs';
import { map, switchMap, takeUntil } from 'rxjs/operators';
import {
  ConfigAPI,
  OptionSpec,
  Schema,
  SchemaInstance,
  WellKnownAnnotations,
} from 'src/app/api';
import { Breadcrump, HeaderTitleService } from 'src/app/layout/header-title';
import { extractErrorMessage } from 'src/app/utils';
import { SettingEditorComponent } from '../setting-editor';
import { SettingTestComponent } from '../setting-test';

@Component({
  templateUrl: './setting-view.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    HlmTableModule,
    KeyValuePipe,
    RouterLink,
    HlmButtonDirective,
    SettingEditorComponent,
    FormsModule
  ]
})
export class SettingViewComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private reload$ = new BehaviorSubject<void>(undefined);

  @ViewChild('singleValueModel', { static: false, read: NgModel })
  singleValueModel: NgModel | null = null;

  tableKeys: OptionSpec[] = [];

  schema: Schema | null = null;
  configs:
    | {
        [key: string]: SchemaInstance;
      }
    | SchemaInstance = {};

  originalValue:
    | {
        [key: string]: SchemaInstance;
      }
    | SchemaInstance = {};

  singleModeID: string | null = '';

  singleMode = false;

  trackByKey: TrackByFunction<KeyValue<string, any>> = (
    _: number,
    kv: KeyValue<string, any>
  ) => kv.key;

  constructor(
    private configAPI: ConfigAPI,
    private headerTitleService: HeaderTitleService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private modal: HlmDialogService,
    public domSanitizer: DomSanitizer
  ) {}

  saveSetting() {
    if (!this.schema) {
      return;
    }

    let stream: Observable<{ warning?: string }>;

    if (!!this.singleModeID) {
      stream = this.configAPI.updateSetting(
        this.schema.name,
        this.singleModeID,
        this.configs
      );
    } else {
      stream = this.configAPI.createSetting(this.schema.name, this.configs);
    }

    stream.subscribe({
      next: (res) => {
        if (!!res.warning) {
          toast.warning(res.warning);
        } else {
          toast.success(
            'Einstellungen erfolgreich gespeichert'
          );
        }

        this.configAPI.reload();
        if (this.schema.multi) {
          this.router.navigate(['..'], { relativeTo: this.route });
        } else {
          this.reload$.next();
        }
      },
      error: (err) =>
        toast.error(extractErrorMessage(err, 'Fehler')),
    });
  }

  deleteSetting(id?: string) {
    if (id === undefined && this.singleMode) {
      id = this.singleModeID;
    }
    if (id === undefined) {
      return;
    }

    this.configAPI.deleteSetting(this.schema!.name, id).subscribe({
      next: (res) => {
        if (!!res.warning) {
          toast.warning(res.warning);
        } else {
          toast.success('Einstellungen erfolgreich gelöscht.');
        }

        this.configAPI.reload();
        if (this.schema.multi && !this.singleMode) {
          this.router.navigate(['..'], { relativeTo: this.route });
        } else {
          this.reload$.next();
        }
      },
      error: (err) =>
        toast.error(extractErrorMessage(err, 'Fehler')),
    });
  }

  testSetting() {
    if (!this.singleMode || !this.schema.tests.length) {
      return;
    }

    this.modal.open(SettingTestComponent, {
      context: {
        schema: this.schema,
        config: this.configs,
      },
      contentClass: 'w-1/2',
    });
  }

  ngOnInit(): void {
    combineLatest([this.route.paramMap, this.reload$])
      .pipe(
        switchMap(([params]) => {
          let name = params.get('name').toLowerCase();
          return forkJoin({
            schema: this.configAPI
              .listSchemas()
              .pipe(
                map((schemas) =>
                  schemas.find((s) => s.name.toLowerCase() === name)
                )
              ),
            settings: this.configAPI.getSettings(name),
            params: of(params),
          });
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((result) => {
        if (!result.schema) {
          this.router.navigate(['/admin/settings']);
          return;
        }

        this.schema = result.schema;
        this.configs = result.settings;

        let specs = new Map<string, OptionSpec>();
        this.schema.options.forEach((val) => specs.set(val.name, val));

        const overviewFieldAnnotation =
          this.configAPI.getAnnotation(
            this.schema,
            WellKnownAnnotations.OverviewFields
          ) || [];
        if (!!overviewFieldAnnotation) {
          this.tableKeys = [];
          overviewFieldAnnotation.forEach((key) => {
            const s = specs.get(key);
            if (!!s) {
              this.tableKeys.push(s);
            }
          });
        }

        // If this kind of configuration can only exist once make sure
        // we have an empty model to work with.
        const sid = result.params.get('sid');
        if (!this.schema.multi || !!sid) {
          this.singleMode = true;

          if (!!sid) {
            if (sid !== 'new') {
              this.singleModeID = sid;
            } else {
              this.singleModeID = '';
            }
          } else {
            this.singleModeID = Object.keys(result.settings)[0] || '';
          }

          if (!!this.singleModeID) {
            this.configs = result.settings[this.singleModeID];
          } else {
            this.configs = {};
          }

          this.originalValue = { ...this.configs };
        } else {
          this.singleMode = false;
          this.singleModeID = null;
          this.originalValue = {};
          Object.keys(result.settings).forEach((key) => {
            this.originalValue[key] = {
              ...result.settings[key],
            };
          });
        }

        let breadcrumps: Breadcrump[] = [
          { name: 'Administration', route: '/admin/' },
        ];

        if (this.singleMode && this.schema.multi) {
          breadcrumps.push({
            name: this.schema.displayName || this.schema.name,
            route: '/admin/settings/' + this.schema.name,
          });
        }

        this.headerTitleService.set(
          result.schema.displayName || result.schema.name,
          '',
          null,
          breadcrumps
        );

        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.reload$.complete();
    this.destroy$.next();
    this.destroy$.complete();
  }
}
