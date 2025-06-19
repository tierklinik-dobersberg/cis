import { DialogRef } from '@angular/cdk/dialog';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, TemplateRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Timestamp } from '@bufbuild/protobuf';
import { ConnectError } from '@connectrpc/connect';
import { lucideAlarmClock, lucideX } from '@ng-icons/lucide';
import { BrnDialogRef, BrnDialogService, BrnDialogState } from '@spartan-ng/ui-dialog-brain';
import { HlmBadgeDirective } from '@tierklinik-dobersberg/angular/badge';
import { HlmButtonDirective } from '@tierklinik-dobersberg/angular/button';
import { injectBoardService, injectTaskService } from '@tierklinik-dobersberg/angular/connect';
import { HlmIconComponent, provideIcons } from '@tierklinik-dobersberg/angular/icon';
import { HlmInputDirective } from '@tierklinik-dobersberg/angular/input';
import { HlmLabelDirective } from '@tierklinik-dobersberg/angular/label';
import { ToDatePipe } from '@tierklinik-dobersberg/angular/pipes';
import { HlmSheetModule } from '@tierklinik-dobersberg/angular/sheet';
import { HlmTableModule } from '@tierklinik-dobersberg/angular/table';
import {
  Board,
  ListTasksResponse,
  Task,
  TaskEvent,
} from '@tierklinik-dobersberg/apis/tasks/v1';
import { merge } from 'hammerjs';
import { toast } from 'ngx-sonner';
import { interval, startWith, Subscription, switchMap } from 'rxjs';
import { injectCurrentConfig } from 'src/app/api';
import { TkdDatePickerComponent, TkdDatePickerInputDirective } from 'src/app/components/date-picker';
import { TagListComponent } from 'src/app/features/tasks/tag-list/tag-list';
import { EventService } from 'src/app/services/event.service';
import { TkdDatePickerTriggerComponent } from "../../components/date-picker/picker-trigger/picker-trigger.component";

@Component({
  selector: 'app-important-tasks',
  standalone: true,
  templateUrl: './important-tasks-button.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ToDatePipe,
    DatePipe,
    HlmButtonDirective,
    HlmIconComponent,
    HlmBadgeDirective,
    HlmSheetModule,
    HlmLabelDirective,
    TagListComponent,
    TkdDatePickerComponent,
    TkdDatePickerInputDirective,
    TkdDatePickerTriggerComponent,
    HlmTableModule,
    TkdDatePickerTriggerComponent,
    HlmInputDirective,
    FormsModule,
],
  providers: [
    ...provideIcons({
        lucideAlarmClock,
        lucideX
    })
  ]
})
export class ImportantTasksButtonComponent {
  private readonly taskService = injectTaskService();
  private readonly boardService = injectBoardService();
  private readonly eventsService = inject(EventService)
  private readonly dialog = inject(BrnDialogService)

  protected readonly config = injectCurrentConfig();
  protected readonly importantTasks = signal<Task[]>([]);
  protected readonly board = signal<Board | null>(null)

  protected readonly taskModel = computed(() => {
    const title = this.newSummary();
    const date = this.dueTime();
    const tags = this.tags();

    return new Task({
      title,
      dueTime: Timestamp.fromDate(date),
      tags,
    });
  })

  protected readonly newSummary = signal('');
  protected readonly tags = signal<string[]>([]);
  protected readonly dueTime = signal<Date>(new Date())

  protected readonly datePickerState = signal<BrnDialogState>('closed');

  @ViewChild('overlay', {read: TemplateRef, static: true})
  overlay: TemplateRef<any>;

  private dialogRef: BrnDialogRef | undefined;

  protected toggleOverlay(element: HTMLButtonElement) {
    if (this.dialogRef) {
      this.dialogRef.close()
      return
    }

    this.dialogRef = this.dialog
      .open(this.overlay, undefined, {}, {
        closeOnOutsidePointerEvents: false,
        panelClass: 'bg-white rounded-md border border-border p-2 shadow-lg',
        hasBackdrop: false,
        attachTo: element,
        attachPositions: [
          {
            originX: 'start',
            originY: 'bottom',
            overlayX: 'start',
            overlayY: 'top',
          },
          {
            originX: 'start',
            originY: 'bottom',
            overlayX: 'center',
            overlayY: 'top',
          },
          {
            originX: 'start',
            originY: 'bottom',
            overlayX: 'end',
            overlayY: 'top',
          },
        ],
      });

      // TODO(ppacher): propose that BrnDialogRef makes acess to cdkDialogRef public.
      ((this.dialogRef as any)._cdkDialogRef as DialogRef)
        .outsidePointerEvents
        .subscribe(e => {
          console.log("state", this.datePickerState())
          if (this.datePickerState() === 'open') {
            return
          }

          this.dialogRef.close()
        })

      this.dialogRef
        .closed$
        .subscribe(() => this.dialogRef = null)
  }

  protected createTask() {
    this.taskService
      .createTask({
        ...this.taskModel(),
        boardId: this.board().id,
      })
      .catch(err => {
        toast.error('Task konnte nicht erstellt werden', {
          description: ConnectError.from(err).message
        })
      })
      .then(() => {
        this.newSummary.set('')
        this.dueTime.set(new Date())
        this.tags.set([])
      })
  }

  protected toggleTag(t: string) {
    const tags = [...this.tags()];

    const idx = tags.findIndex(e => e === t)
    if (idx < 0) {
      tags.push(t)
    } else {
      tags.splice(idx, 1)
    }

    this.tags.set(tags)
  }

  completeTask(task: Task) {
    this.taskService
        .completeTask({
            taskId: task.id
        })
        .catch(err => {
            toast.error('Task konnte nicht gelöscht werden', {
                description: ConnectError.from(err).message
            })
        })
  }

  constructor() {
    effect(() => {
      console.log("picker", this.datePickerState())
    })

    let sub = Subscription.EMPTY;
    effect(() => {
      const config = this.config();
      sub.unsubscribe();

      if (config.UI?.ImportantTasksBoard) {
        this.boardService
            .getBoard({id: config.UI.ImportantTasksBoard})
            .then(b => this.board.set(b.board))
            

        const sub = merge(
          interval(10 * 60 * 1000),
          this.eventsService.subscribe(new TaskEvent())
        )
          .pipe(
            startWith(-1),
            switchMap(() => {
              return this.taskService
                .filterTasks({
                  boardId: config.UI.ImportantTasksBoard,
                  query: config.UI.ImportantTasksFilter,
                })
                .catch(err => {
                  toast.error('Failed to load important tasks', {
                    description: ConnectError.from(err).message,
                  });

                  return new ListTasksResponse();
                });
            })
          )
          .subscribe(res => {
            this.importantTasks.set(res.tasks || []);
          });
      }
    });
  }
}
