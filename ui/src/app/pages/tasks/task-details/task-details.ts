import { DatePipe, NgClass } from "@angular/common";
import { AfterViewInit, ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, Injector, output, signal, ViewChild } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { PartialMessage, Timestamp } from "@bufbuild/protobuf";
import { CKEditorModule } from "@ckeditor/ckeditor5-angular";
import { ConnectError } from "@connectrpc/connect";
import { lucideActivity, lucideCalendarCheck, lucideCheck, lucideCheckCheck, lucideCircleDot, lucideClock, lucideLayers, lucideMoreVertical, lucideMove, lucideMoveHorizontal, lucideTags, lucideTrash2, lucideUser, lucideUser2, lucideX } from "@ng-icons/lucide";
import { BrnAlertDialogModule } from "@spartan-ng/ui-alertdialog-brain";
import { BrnSeparatorComponent } from "@spartan-ng/ui-separator-brain";
import { BrnSheetContentDirective, BrnSheetTriggerDirective } from "@spartan-ng/ui-sheet-brain";
import { BrnTooltipModule } from "@spartan-ng/ui-tooltip-brain";
import { HlmAlertDialogModule } from "@tierklinik-dobersberg/angular/alertdialog";
import { HlmBadgeDirective } from "@tierklinik-dobersberg/angular/badge";
import { injectCurrentProfile, injectUserProfiles } from "@tierklinik-dobersberg/angular/behaviors";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { injectBoardService, injectTaskService } from "@tierklinik-dobersberg/angular/connect";
import { HlmIconModule, provideIcons } from "@tierklinik-dobersberg/angular/icon";
import { HlmInputDirective } from "@tierklinik-dobersberg/angular/input";
import { HlmLabelDirective } from "@tierklinik-dobersberg/angular/label";
import { DisplayNamePipe, ToDatePipe, ToUserPipe } from "@tierklinik-dobersberg/angular/pipes";
import { HlmSeparatorDirective } from "@tierklinik-dobersberg/angular/separator";
import { HlmSheetComponent, HlmSheetModule } from "@tierklinik-dobersberg/angular/sheet";
import { HlmSkeletonComponent } from "@tierklinik-dobersberg/angular/skeleton";
import { HlmTableModule } from "@tierklinik-dobersberg/angular/table";
import { HlmTooltipModule } from "@tierklinik-dobersberg/angular/tooltip";
import { Board, BoardEvent, EventType, GetTimelineResponse, Task, TaskEvent, TaskTimelineEntry, UpdateTaskRequest } from '@tierklinik-dobersberg/apis/tasks/v1';
import { MarkdownModule } from "ngx-markdown";
import { toast } from "ngx-sonner";
import { startWith } from "rxjs";
import { injectCurrentConfig } from "src/app/api";
import { MyEditor } from "src/app/ckeditor";
import { AppAvatarComponent } from "src/app/components/avatar";
import { TkdDatePickerComponent, TkdDatePickerInputDirective } from "src/app/components/date-picker";
import { UserColorVarsDirective } from "src/app/components/user-color-vars";
import { ContrastColorPipe } from "src/app/pipes/contrast-color.pipe";
import { EventService } from "src/app/services/event.service";
import { StatusColorPipe } from "../color.pipe";
import { SubscriptionButton } from "../subscription-button/subscription-button";
import { TagListComponent } from "../tag-list/tag-list";
import { TaskAssigneeComponent } from "../task-assignee/task-assignee";
import { TaskPriorityComponent } from "../task-priority/task-priority";
import { TaskStatusComponent } from "../task-status/task-status";
import { TimelineEntryComponent } from '../timeline-entry/timeline-entry';

@Component({
    selector: 'app-task-details',
    templateUrl: './task-details.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        HlmIconModule,
        HlmButtonDirective,
        HlmLabelDirective,
        CKEditorModule,
        HlmInputDirective,
        MarkdownModule,
        BrnSeparatorComponent,
        HlmSeparatorDirective,
        ToDatePipe,
        DatePipe,
        ToUserPipe,
        DisplayNamePipe,
        HlmInputDirective,
        FormsModule,
        AppAvatarComponent,
        HlmBadgeDirective,
        CKEditorModule,
        HlmTableModule,
        ContrastColorPipe,
        StatusColorPipe,
        BrnSheetTriggerDirective,
        HlmSheetModule,
        BrnSheetContentDirective,
        UserColorVarsDirective,
        RouterLink,
        TkdDatePickerComponent,
        TkdDatePickerInputDirective,
        HlmSkeletonComponent,
        TagListComponent,
        TaskStatusComponent,
        TaskPriorityComponent,
        TaskAssigneeComponent,
        SubscriptionButton,
        HlmAlertDialogModule,
        TimelineEntryComponent,
        BrnAlertDialogModule,
        HlmTooltipModule,
        BrnTooltipModule,
        NgClass
    ],
    providers: [
        ...provideIcons({
            lucideTags,
            lucideClock,
            lucideCheck,
            lucideCheckCheck,
            lucideUser,
            lucideUser2,
            lucideTrash2,
            lucideMoreVertical,
            lucideMoveHorizontal,
            lucideMove,
            lucideActivity,
            lucideCalendarCheck,
            lucideCircleDot,
            lucideX,
            lucideLayers,
        }),
    ],
})
export class TaskDetailsComponent implements AfterViewInit {
    protected readonly task = signal<Task>(new Task);
    protected readonly currentProfile = injectCurrentProfile();
    protected readonly profiles = injectUserProfiles();
    protected readonly config = injectCurrentConfig();
    protected readonly editor = MyEditor;
    protected readonly injector = inject(Injector);
    protected readonly availableBoards = signal<Board[]>([]);
    protected readonly eventsService = inject(EventService);
    protected readonly timeline = signal<TaskTimelineEntry[]>([]);

    protected readonly board = computed(() => {
        const boards = this.availableBoards();
        const task = this.task();
        if (!task || !task.boardId) {
            return new Board()
        }

        return boards.find(b => b.id == task.boardId);
    })

    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router)
    protected readonly taskService = injectTaskService(); // needs to be passed to app-subscription-button
    private readonly boardService = injectBoardService();

    protected readonly editTitle = signal(false);
    protected readonly editDescription = signal(false);
    protected readonly newCommentText = signal('');

    protected readonly title = signal('');
    protected readonly description = signal('');

    @ViewChild(HlmSheetComponent, { static: true })
    protected sheet: HlmSheetComponent;

    @ViewChild(BrnSheetTriggerDirective, { static: true, read: ElementRef })
    protected triggerButton: ElementRef;

    public readonly closed = output<any>();

    toggleEditTitle() {
        const edit = this.editTitle();

        if (edit && this.title() !== this.task().title ) {
            this.updateTask({title: this.title()})
        }

        this.editTitle.set(!edit)
    }

    toggleEditDescription() {
        const edit = this.editDescription();

        if (edit && this.description() !== this.task().description ) {
            this.updateTask({description: this.description()})
        }

        this.editDescription.set(!edit)
    }

    ngAfterViewInit(): void {
        this.sheet.closed
            .subscribe(value => {
                this.closed.emit(value);

                this.editDescription.set(false);
                this.editTitle.set(false)

                this.router.navigate([], {
                    queryParams: {
                        taskPane: null,
                    },
                    queryParamsHandling: 'merge',
                })
        });
    }

    protected setStatus(status: string) {
        this.updateTask({status});
    }

    protected setAssignee(user: string) {
        this.updateTask({assigneeId: user}, ["assignee_id"]);
    }

    protected setPriority(p: number) {
        this.updateTask({priority: p});
    }

    protected updateDueTime(date?: Date) {
        this.updateTask({
            dueTime: date ? Timestamp.fromDate(date) : null,
        }, ['due_time'])
    }

    protected deleteTask() {
        this.taskService
            .deleteTask({taskId: this.task().id})
            .then(() => {
                this.sheet?.close(null);
            })
            .catch(err => {
                toast.error('Task konnte nicht gelöscht werden', {
                    description: ConnectError.from(err).message
                })
            })
    }

    protected toggleTag(tag: string) {
        const has = this.task().tags?.includes(tag)

        if (!has) {
            this.updateTask({
                tags: {
                    case: 'addTags',
                    value: {
                        values: [tag]
                    }
                }
            })
        } else {
            this.updateTask({
                tags: {
                    case: 'deleteTags',
                    value: {
                        values: [tag]
                    }
                }
            })
        }
    }

    private updateTask(req: PartialMessage<UpdateTaskRequest>, paths?: string[]) {
        paths = paths || Object.keys(req)
        req.taskId = this.task().id;

        req.updateMask = {
            paths
        }

        this.taskService
            .updateTask(req)
            .catch( err => {
                toast.error('Task konnte nicht gespeichert werden', {
                    description: ConnectError.from(err).message
                })
            })
    }

    private loadBoards() {
        this.boardService
            .listBoards({})
            .then(response => {
                this.availableBoards.set(response.boards);
            })
            .catch(err => {
                toast.error('Task-Boards konnten nicht geladen werden', {
                    description: ConnectError.from(err).message
                })
            })
    }

    protected completeTask() {
        this.taskService
            .completeTask({taskId: this.task().id})
            .catch(err => {
                toast.error('Task konnten nicht gespeichert werden', {
                    description: ConnectError.from(err).message
                })
            })
    }

    protected createComment() {
        const text = this.newCommentText();
        if (!text) {
            return
        }

        this.taskService
            .createTaskComment({
                taskId: this.task().id,
                comment: text
            })
            .then(() => {
                this.loadTimeline(this.task().id)
            })
            .catch(err => {
                toast.error('Kommentar konnte nicht erstellt werden', {
                    description: ConnectError.from(err).message
                })
            })

        this.newCommentText.set('')
    }

    constructor() {
        this.eventsService
            .subscribe([new BoardEvent, new TaskEvent])
            .pipe(takeUntilDestroyed(), startWith(new BoardEvent))
            .subscribe((msg) => {
                if (msg instanceof BoardEvent) {
                    this.loadBoards();

                    if (msg.kind.case ==='boardDeleted' && msg.kind.value === this.task().boardId) {
                        this.sheet.close(null);
                    }

                    return
                }

                if (msg instanceof TaskEvent) {
                    if (msg.task.id === this.task().id) {
                        if (msg.eventType === EventType.DELETED) {
                            this.task.set(new Task())
                            return
                        }

                        this.task.set(msg.task);
                        this.loadTimeline(msg.task.id);
                    }
                }
            })

        this.route
            .queryParamMap
            .pipe(takeUntilDestroyed())
            .subscribe(params => {
                const id = params.get("taskPane");
                if (id) {
                    this.taskService
                        .getTask({taskId: id})
                        .then(res => {
                            this.task.set(res.task);
                            this.title.set(res.task.title)
                            this.description.set(res.task.description);
                        })
                        .catch( err => {
                            toast.error('Task konnte nicht geladen werden', {
                                description: ConnectError.from(err).message
                            })

                            this.sheet?.close(null);
                        })

                    this.loadTimeline(id);

                } else {
                    this.sheet?.close(null);
                    this.task.set(new Task())
                }
            })

        effect(() => {
            const task = this.task();

            if (task && task.id && task.boardId) {
                setTimeout(() => {
                    this.triggerButton.nativeElement.click();
                }, 10)
            } else {
                this.sheet?.close(null);
            }
        }, { allowSignalWrites: true })
    }
                    
    private loadTimeline(id: string) {
        this.taskService
            .getTimeline({taskIds: [id]})
            .catch(err => {
                toast.error('Task Aktivitäten konnten nicht geladen werden', {
                    description: ConnectError.from(err).message
                })

                return new GetTimelineResponse()
            })
            .then(response => {
                this.timeline.set(response.timeline)
            })
    }
}