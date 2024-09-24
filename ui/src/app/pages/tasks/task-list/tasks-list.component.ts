import { DatePipe, KeyValuePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { PartialMessage } from "@bufbuild/protobuf";
import { ConnectError } from "@connectrpc/connect";
import { lucideArrowUpDown, lucideCheck, lucideCheckCheck, lucideChevronDown, lucideCircleDot, lucideClock, lucideDot, lucideGroup, lucideMenu, lucideMoreVertical, lucidePencil, lucidePlus, lucideSave, lucideTags, lucideTrash2, lucideUser } from "@ng-icons/lucide";
import { BrnAlertDialogModule } from "@spartan-ng/ui-alertdialog-brain";
import { BrnCommandModule } from "@spartan-ng/ui-command-brain";
import { BrnMenuTriggerDirective } from "@spartan-ng/ui-menu-brain";
import { BrnPopoverModule } from "@spartan-ng/ui-popover-brain";
import { HlmAlertDialogModule } from "@tierklinik-dobersberg/angular/alertdialog";
import { HlmBadgeDirective } from "@tierklinik-dobersberg/angular/badge";
import { injectCurrentProfile, injectUserProfiles } from "@tierklinik-dobersberg/angular/behaviors";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { HlmCardModule } from "@tierklinik-dobersberg/angular/card";
import { HlmCommandModule } from "@tierklinik-dobersberg/angular/command";
import { BoardServiceClient, injectBoardService, injectTaskService } from "@tierklinik-dobersberg/angular/connect";
import { HlmDialogService } from "@tierklinik-dobersberg/angular/dialog";
import { HlmIconModule, provideIcons } from "@tierklinik-dobersberg/angular/icon";
import { HlmInputDirective } from "@tierklinik-dobersberg/angular/input";
import { HlmLabelDirective } from "@tierklinik-dobersberg/angular/label";
import { LayoutService } from "@tierklinik-dobersberg/angular/layout";
import { HlmMenuItemRadioComponent, HlmMenuModule } from "@tierklinik-dobersberg/angular/menu";
import { DisplayNamePipe, ToDatePipe, ToUserPipe } from "@tierklinik-dobersberg/angular/pipes";
import { HlmPopoverModule } from "@tierklinik-dobersberg/angular/popover";
import { Sort } from "@tierklinik-dobersberg/apis/common/v1";
import { Profile } from "@tierklinik-dobersberg/apis/idm/v1";
import { Board, BoardEvent, GetBoardResponse, QueryViewResponse, TaskEvent, UpdateTaskRequest, View } from "@tierklinik-dobersberg/apis/tasks/v1";
import { MarkdownModule } from "ngx-markdown";
import { toast } from "ngx-sonner";
import { AppAvatarComponent } from "src/app/components/avatar";
import { TkdPaginationComponent } from "src/app/components/pagination";
import { EditTaskDialog } from "src/app/dialogs/create-task-dialog";
import { HeaderTitleService } from "src/app/layout/header-title";
import { ContrastColorPipe } from "src/app/pipes/contrast-color.pipe";
import { EventService } from "src/app/services/event.service";
import { StatusColorPipe, TagColorPipe } from "../color.pipe";
import { TaskGroupValueComponent } from "../group-value/group-value";
import { TaskAssigneeComponent } from "../task-assignee/task-assignee";
import { TaskDetailsComponent } from "../task-details/task-details";
import { TaskQueryFilterComponent } from "../task-query-filter/task-query-filter";
import { TaskTableComponent } from "../task-table/task-table";
import { TaskGroupWithBoard } from "../utils";

export class ViewModel extends View {
    private readonly _changeIndex = signal(0);

    public readonly changeIndex = this._changeIndex.asReadonly();
    public readonly isDirty = computed(() => {
        return this._changeIndex() > 0
    })


    constructor(
        v: PartialMessage<View>,
        private readonly boardId: string,
        private readonly boardService: BoardServiceClient,
        dirty = false) {
        super(v);

        if (dirty) {
            this.markDirty()
        }
    }

    markDirty() {
        this._changeIndex.set(this._changeIndex() + 1)
    }

    setFilter(filter: string) {
        this.filter = filter;

        this.markDirty();
    }

    setGroupBy(field: string) {
        this.groupByField = field;
        this.markDirty();
    }

    setSort(field: string) {
        this.sort = new Sort({
            fieldName: field,
        })

        this.markDirty();
    }

    delete() {
        this.boardService
            .deleteView({
                boardId: this.boardId,
                viewName: this.name,
            })
            .catch(err => {
                toast.error('Board konnte nicht gelöscht werden', {
                    description: ConnectError.from(err).message,
                })
            })
    }

    save() {
        this.boardService
            .addView({
                boardId: this.boardId,
                view: this
            })
            .then(() => this._changeIndex.set(0))
            .catch(err => {
                toast.error('Board konnte nicht gespeichert werden', {
                    description: ConnectError.from(err).message,
                })
            })
    }
}

@Component({
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './tasks-list.component.html',
    imports: [
        HlmButtonDirective,
        HlmCardModule,
        MarkdownModule,
        HlmBadgeDirective,
        HlmIconModule,
        ToDatePipe,
        DatePipe,
        TkdPaginationComponent,
        RouterLink,
        TagColorPipe,
        StatusColorPipe,
        HlmLabelDirective,
        HlmMenuModule,
        BrnMenuTriggerDirective,
        DisplayNamePipe,
        HlmAlertDialogModule,
        BrnAlertDialogModule,
        ToUserPipe,
        AppAvatarComponent,
        FormsModule,
        HlmInputDirective,
        FormsModule,
        ContrastColorPipe,
        TaskDetailsComponent,
        TaskTableComponent,
        TaskAssigneeComponent,
        TaskQueryFilterComponent,
        HlmPopoverModule,
        BrnPopoverModule,
        BrnCommandModule,
        HlmCommandModule,
        KeyValuePipe,
        TaskGroupValueComponent,
        HlmMenuItemRadioComponent
    ],
    host: {
        'class': '!p-0'
    },
    providers: [
        ...provideIcons({lucideDot, lucideSave ,lucideGroup, lucideArrowUpDown, lucideChevronDown ,lucidePlus ,lucideCheck, lucideUser, lucideCircleDot, lucideTags, lucideCheckCheck, lucideTrash2, lucideClock, lucideMenu, lucideMoreVertical, lucidePencil})
    ]
})
export class TaskListComponent {
    private readonly boardService = injectBoardService();
    private readonly taskService = injectTaskService();
    private readonly activeRoute = inject(ActivatedRoute)
    private readonly dialogService = inject(HlmDialogService)
    private readonly eventsService = inject(EventService);
    private readonly router = inject(Router);
    private header = inject(HeaderTitleService)

    private readonly boardId = signal<string | null>(null);

    protected readonly layout = inject(LayoutService)
    protected readonly profiles = injectUserProfiles();
    protected readonly currentProfile = injectCurrentProfile();
    protected readonly board = signal<Board>(new Board())
    protected readonly groups = signal<TaskGroupWithBoard[]>([]);

    protected readonly tasks = computed(() => {
        const result =  this.groups()
            .reduce((sum, grp) => {
                return [
                    ...sum,
                    ...grp.tasks
                ]
            }, [])

        console.log("all tasks", result)

        return result
    })

    protected readonly views = signal<ViewModel[]>([]);

    protected readonly newTaskTitle = signal('');

    protected readonly groupByFields = {
        'assignee_id': 'Zugewiesen',
        'due_time': 'Fälligkeit',
        'creator_id': 'Besitzer',
        'status': 'Status',
        'tags': 'Tags',
        'priority': 'Priorität'
    }

    protected readonly sortByFields = {
        'assignee_id': 'Zugewiesen',
        'due_time': 'Fälligkeit',
        'creator_id': 'Besitzer',
        'status': 'Status',
        'tags': 'Tags',
        'priority': 'Priorität'
    }

    protected readonly currentView = signal<ViewModel | null>(null);

    protected readonly _computedEligibleUsers = computed(() => {
        const groups = this.groups();
        const board = this.board();
        const profiles = this.profiles();

        const result: {
            [taskId: string]: Profile[]
        } = {}

        groups
            .forEach(grp => {
                grp.tasks
                    .forEach(task => {
                    if (!board.eligibleRoleIds?.length && !board.eligibleUserIds?.length) {
                        result[task.id] = profiles;
                        return
                    }

                    result[task.id] = profiles.filter(p => {
                        if (board.eligibleUserIds.includes(p.user.id)) {
                            return true
                        }

                        return p.roles.find(r => board.eligibleRoleIds.includes(r.id)) !== undefined;
                    })
                })
            })

        return result
    })

    protected createOrEditTask(taskId?: string) {
        EditTaskDialog.open(this.dialogService, this.boardId(), taskId)
    }

    protected showDetails(taskId: string) {
        this.router.navigate([], {
            queryParams: {
                taskPane: taskId,
            },
            queryParamsHandling: 'merge',
        })
    }

    constructor() {
            this.activeRoute
                .paramMap
            .pipe(takeUntilDestroyed())
            .subscribe(params => {
                const boardId = params.get("boardId")
                this.boardId.set(boardId)
            })

        this.eventsService
            .listen([new TaskEvent, new BoardEvent])
            .pipe(takeUntilDestroyed())
            .subscribe(msg => {
                if (msg instanceof TaskEvent && msg.task?.boardId === this.boardId()) {
                    this.board.set(this.board().clone())
                } else if (msg instanceof BoardEvent) {
                    switch (msg.kind.case) {
                        case 'boardCreated':
                            return
                        case 'boardDeleted':
                            if (msg.kind.value === this.boardId()) {
                                this.router.navigate(['/welcome'])
                            }
                            return

                        case 'boardUpdated':
                            if (msg.kind.value.id !== this.boardId()) {
                                return
                            }
                    }

                    // refetch the board
                    const id = this.boardId();
                    this.loadBoard(id);
                }
            })

        effect(() => {
            const id = this.boardId();

            if (!id) {
                return
            }

            this.loadBoard(id);
        })


        effect(() => {
            const board = this.board()
            const view = this.currentView();

            if (!view || !board.id) {
                return
            }

            // track the view
            view.changeIndex();

            this.taskService
                .queryView({
                    boardIds: [board.id],
                    view,
                })
                .catch(err => {
                    toast.error('Tasks konnte nicht geladen werden', {
                        description: ConnectError.from(err).message
                    })

                    return new QueryViewResponse()
                })
                .then(response => {
                    const m = new Map<string, Board>();
                    response.boards
                        .forEach(b => m.set(b.id, b))

                    this.groups
                        .set(response.groups.map(g => new TaskGroupWithBoard(g, m.get(g.boardId), response.groupByField)));
                })
        })
    }
            
    protected loadBoard(id: string) {
        this.boardService
            .getBoard({id})
            .catch(err => {
                toast.error('Task-Board konnte nicht geladen werden', {
                    description: ConnectError.from(err).message
                })

                return new GetBoardResponse()
            })
            .then(response => {
                this.board.set(response.board)
                this.views.set(
                    response.board.views?.length
                    ? response.board.views
                        .map(v => new ViewModel(v, response.board.id, this.boardService))
                    : [
                        new ViewModel({
                            name: "Home",
                            filter: "",
                        }, response.board.id, this.boardService)
                    ]
                )

                const oldView = this.views().find(v => v === this.currentView());
                if (this.currentView() === null || oldView === undefined ) {
                    this.currentView.set(this.views()[0])
                } else {
                    // we need to re-set the old view since we have a new class instance now
                    this.currentView.set(oldView);
                }

                this.header.set(response.board.displayName, response.board.description)
            })
        }

    protected completeTask(taskId: string) {
        this.taskService
            .completeTask({
                taskId: taskId
            })
            .catch(err => {
                toast.error('Task konnte nicht als fertig markiert werden', {
                    description: ConnectError.from(err).message
                })
            })
    }

    protected deleteTask(taskId: string) {
        this.taskService
            .deleteTask({
                taskId: taskId
            })
            .catch(err => {
                toast.error('Task konnte nicht gelöscht werden', {
                    description: ConnectError.from(err).message
                })
            })
    }

    protected setStatus(taskId: string, status: string) {
        const task = this.tasks().find(t => t.id === taskId);
        if (!task) {
            return
        }

        this.taskService.updateTask({
            taskId: taskId,
            status: status,
            updateMask: {
                paths: ["status"]
            }
        })
            .catch(err => {
                toast.error('Tasks konnte nicht gespeichert werden', {
                    description: ConnectError.from(err).message
                })
            })
    }

    protected setPriority(taskId: string, value: number) {
        const task = this.tasks().find(t => t.id === taskId);
        if (!task) {
            return
        }

        this.taskService.updateTask({
            taskId: taskId,
            priority: value,
            updateMask: {
                paths: ["priority"]
            }
        })
            .catch(err => {
                toast.error('Tasks konnte nicht gespeichert werden', {
                    description: ConnectError.from(err).message
                })
            })
    }

    protected assignTask(taskId: string, user: string) {
        const task = this.tasks().find(t => t.id === taskId);
        if (!task) {
            return
        }

        this.taskService.updateTask({
            taskId: taskId,
            assigneeId: user,
            updateMask: {
                paths: ["assignee_id"]
            }
        })
            .catch(err => {
                toast.error('Tasks konnte nicht gespeichert werden', {
                    description: ConnectError.from(err).message
                })
            })
    }

    protected toggleTag(taskId: string, tag: string) {
        const task = this.tasks().find(t => t.id === taskId);
        if (!task) {
            return
        }

        const req: PartialMessage<UpdateTaskRequest> = {
            taskId: taskId,
            updateMask: {
                paths: ["tags"]
            }
        }

        const has = task.tags.includes(tag);
        if (has) {
            req.tags = {
                case: 'deleteTags',
                value: {
                    values: [tag]
                }
            }
        } else {
            req.tags = {
                case: 'addTags',
                value: {
                    values: [tag]
                }
            }
        }

        console.log(req);

        this.taskService.updateTask(req)
            .catch(err => {
                toast.error('Tasks konnte nicht gespeichert werden', {
                    description: ConnectError.from(err).message
                })
            })
    }

    protected createNewTask() {
        const title = this.newTaskTitle();

        if (!title) {
            return;
        }

        this.taskService
            .createTask({
                boardId: this.board()?.id,
                title: title,
            })
            .then(() => this.newTaskTitle.set(''))
            .catch(err => {
                toast.error('Task konnte nicht erstellt werden', {
                    description: ConnectError.from(err).message
                })
            })
    }

    protected addView() {
        const views = [...this.views()]

        views.push(new ViewModel({
            name: 'Neue Ansicht'
        }, this.boardId(), this.boardService, true))

        this.views.set(views);
    }
}