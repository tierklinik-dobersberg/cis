import {
    CdkColumnResizeDefaultEnabledModule,
    ColumnResize,
    ColumnResizeNotifierSource,
    HeaderRowEventDispatcher,
    Resizable,
    ResizeOverlayHandle,
    ResizeRef,
    ResizeStrategy,
} from '@angular/cdk-experimental/column-resize';
import { Directionality } from '@angular/cdk/bidi';
import { Overlay } from '@angular/cdk/overlay';
import {
    _COALESCED_STYLE_SCHEDULER,
    _CoalescedStyleScheduler,
    CdkColumnDef,
    CdkTableModule,
} from '@angular/cdk/table';
import { DatePipe, DOCUMENT } from '@angular/common';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    computed,
    Directive,
    ElementRef,
    inject,
    Injector,
    input,
    NgZone,
    output,
    TrackByFunction,
    Type,
    ViewChild,
    ViewContainerRef,
    ViewEncapsulation
} from '@angular/core';
import { HlmButtonDirective } from '@tierklinik-dobersberg/angular/button';
import { ToDatePipe } from '@tierklinik-dobersberg/angular/pipes';
import { HlmTableModule } from '@tierklinik-dobersberg/angular/table';
import { Board, Task } from '@tierklinik-dobersberg/apis/tasks/v1';
import { AppAvatarComponent } from 'src/app/components/avatar';
import { TagListComponent } from '../tag-list/tag-list';
import { TaskAssigneeComponent } from '../task-assignee/task-assignee';
import { TaskStatusComponent } from '../task-status/task-status';

@Directive({
  standalone: true,
  selector: '[cdkCellDef]',
})
export class CdkCellDefTemplateGuard {
  static ngTemplateContextGuard(
    dir: CdkCellDefTemplateGuard,
    ctx: unknown
  ): ctx is { $implicit: Task } {
    return true;
  }
}

/**
 * Component shown over the edge of a resizable column that is responsible
 * for handling column resize mouse events and displaying a vertical line along the column edge.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  host: {'class': 'cdk-column-resize-overlay-thumb mat-column-resize-overlay-thumb'},
  template: '<div #top class="cdk-column-resize-overlay-thumb-top"></div>'
})
export class ColumnResizeOverlayHandle extends ResizeOverlayHandle {
  protected readonly columnDef = inject(CdkColumnDef);
  protected readonly columnResize = inject(ColumnResize);
  protected readonly directionality = inject(Directionality);
  protected readonly elementRef = inject(ElementRef);
  protected readonly eventDispatcher = inject(HeaderRowEventDispatcher);
  protected readonly ngZone = inject(NgZone);
  protected readonly resizeNotifier = inject(ColumnResizeNotifierSource);
  protected readonly resizeRef = inject(ResizeRef);
  protected readonly styleScheduler = inject<_CoalescedStyleScheduler>(
    _COALESCED_STYLE_SCHEDULER
  );
  protected readonly document = inject(DOCUMENT);

  @ViewChild('top', { static: true }) topElement: ElementRef<HTMLElement>;

  constructor() {
    super();
  }
}

/**
 * Explicitly enables column resizing for a mat-header-cell.
 */
@Directive({
  selector: '[cdk-header-cell]:not([noResize])',
  standalone: true,
  host: {
    'class': 'cdk-resizable',
  }
})
export class MyResizable extends Resizable<ColumnResizeOverlayHandle> {
  protected readonly columnDef = inject(CdkColumnDef);
  protected readonly columnResize = inject(ColumnResize);
  protected readonly directionality = inject(Directionality);
  protected readonly elementRef = inject(ElementRef);
  protected readonly eventDispatcher = inject(HeaderRowEventDispatcher);
  protected readonly injector = inject(Injector);
  protected readonly ngZone = inject(NgZone);
  protected readonly overlay = inject(Overlay);
  protected readonly resizeNotifier = inject(ColumnResizeNotifierSource);
  protected readonly resizeStrategy = inject(ResizeStrategy);
  protected readonly styleScheduler = inject<_CoalescedStyleScheduler>(
    _COALESCED_STYLE_SCHEDULER
  );
  protected readonly viewContainerRef = inject(ViewContainerRef);
  protected readonly changeDetectorRef = inject(ChangeDetectorRef);
  protected readonly document = inject(DOCUMENT);

  protected getOverlayHandleComponentType(): Type<ColumnResizeOverlayHandle> {
    console.log('returning overlay handle');
    return ColumnResizeOverlayHandle;
  }

  protected getInlineHandleCssClassName(): string {
    return 'cdk-resizable-handle';
  }
}

@Component({
  selector: 'app-task-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrls: ['./task-table.scss'],
  templateUrl: './task-table.html',
  imports: [
    CdkTableModule,
    HlmButtonDirective,
    HlmTableModule,
    CdkCellDefTemplateGuard,
    AppAvatarComponent,
    TagListComponent,
    TaskStatusComponent,
    TaskAssigneeComponent,
    CdkColumnResizeDefaultEnabledModule,
    MyResizable,
    ColumnResizeOverlayHandle,
    ToDatePipe,
    DatePipe
  ],
})
export class TaskTableComponent {
  public readonly board = input.required<Board>();
  public readonly tasks = input.required<Task[]>();
  public readonly taskClick = output<Task>();
  public readonly tagSwitch = output<[Task, string]>();
  public readonly statusSwitch = output<[Task, string]>();
  public readonly assigneeSwitch = output<[Task, string]>();

  protected readonly trackTask: TrackByFunction<Task> = (_, t) => t.id;

  protected readonly displayedColumns = computed(() => {
    return ['title', 'status', 'assignee', 'dueTime', 'tags', 'creator'];
  });
}
