import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, effect, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { PartialMessage } from "@bufbuild/protobuf";
import { ConnectError } from "@connectrpc/connect";
import { lucideCheck, lucideCheckCheck, lucideCircleDot, lucideClock, lucideMenu, lucideMoreVertical, lucidePencil, lucideTags, lucideTrash2, lucideUser } from "@ng-icons/lucide";
import { BrnAlertDialogModule } from "@spartan-ng/ui-alertdialog-brain";
import { BrnMenuTriggerDirective } from "@spartan-ng/ui-menu-brain";
import { HlmAlertDialogModule } from "@tierklinik-dobersberg/angular/alertdialog";
import { HlmBadgeDirective } from "@tierklinik-dobersberg/angular/badge";
import { injectCurrentProfile, injectUserProfiles } from "@tierklinik-dobersberg/angular/behaviors";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { HlmCardModule } from "@tierklinik-dobersberg/angular/card";
import { injectBoardService, injectTaskService } from "@tierklinik-dobersberg/angular/connect";
import { HlmDialogService } from "@tierklinik-dobersberg/angular/dialog";
import { HlmIconModule, provideIcons } from "@tierklinik-dobersberg/angular/icon";
import { HlmInputDirective } from "@tierklinik-dobersberg/angular/input";
import { LayoutService } from "@tierklinik-dobersberg/angular/layout";
import { HlmMenuModule } from "@tierklinik-dobersberg/angular/menu";
import { DisplayNamePipe, ToDatePipe, ToUserPipe } from "@tierklinik-dobersberg/angular/pipes";
import { Profile } from "@tierklinik-dobersberg/apis/idm/v1";
import { Board, BoardEvent, GetBoardResponse, ListTasksResponse, Task, TaskEvent, UpdateTaskRequest } from "@tierklinik-dobersberg/apis/tasks/v1";
import { MarkdownModule } from "ngx-markdown";
import { toast } from "ngx-sonner";
import { AppAvatarComponent } from "src/app/components/avatar";
import { TkdPaginationComponent } from "src/app/components/pagination";
import { EditTaskDialog } from "src/app/dialogs/create-task-dialog";
import { ContrastColorPipe } from "src/app/pipes/contrast-color.pipe";
import { EventService } from "src/app/services/event.service";
import { AsyncPaginationManager } from "src/app/utils/pagination-manager";
import { StatusColorPipe, TagColorPipe } from "../color.pipe";
import { TaskAssigneeComponent } from "../task-assignee/task-assignee";
import { TaskDetailsComponent } from "../task-details/task-details";
import { TaskQueryFilterComponent } from "../task-query-filter/task-query-filter";
import { TaskTableComponent } from "../task-table/task-table";

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
    ],
    host: {
        'class': '!p-0'
    },
    providers: [
        ...provideIcons({lucideCheck, lucideUser, lucideCircleDot, lucideTags, lucideCheckCheck, lucideTrash2, lucideClock, lucideMenu, lucideMoreVertical, lucidePencil})
    ]
})
export class TaskListComponent {
    private readonly boardService = injectBoardService();
    private readonly taskService = injectTaskService();
    private readonly activeRoute = inject(ActivatedRoute)
    private readonly dialogService = inject(HlmDialogService)
    private readonly eventsService = inject(EventService);
    private readonly router = inject(Router);
    private readonly cdr = inject(ChangeDetectorRef)

    private readonly boardId = signal<string | null>(null);

    protected readonly layout = inject(LayoutService)
    protected readonly profiles = injectUserProfiles();
    protected readonly currentProfile = injectCurrentProfile();
    protected readonly board = signal<Board>(new Board())
    protected readonly tasks = signal<Task[]>([]);
    protected readonly filter = signal('');

    protected readonly newTaskTitle = signal('');

    protected readonly paginator = new AsyncPaginationManager(this.tasks)

    protected readonly _computedEligibleUsers = computed(() => {
        const tasks = this.tasks();
        const board = this.board();
        const profiles = this.profiles();

        const result: {
            [taskId: string]: Profile[]
        } = {}

        tasks.forEach(task => {
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
                        })
                }
            })

        effect(() => {
            const id = this.boardId();

            if (!id) {
                return
            }

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
                })
        })


        effect(() => {
            const board = this.board()
            const pageSize = this.paginator.pageSize();
            const page = this.paginator.currentPage();
            const filter = this.filter();

            if (!board.id){
                return
            }

            this.taskService
                .filterTasks({
                    boardId: board.id,
                    query: filter,
                    pagination: {
                        pageSize: pageSize,
                        kind: {
                            case: 'page',
                            value: page,
                        }
                    }
                })
                .catch(err => {
                    toast.error('Tasks konnte nicht geladen werden', {
                        description: ConnectError.from(err).message
                    })

                    return new ListTasksResponse()
                })
                .then(responses => {
                    this.tasks.set(responses.tasks);
                    this.paginator.setTotalCount(Number(responses.totalCount))

                    // BUG(ppacher): MarkdownModule does not pickup a change in the task description
                    // if we don't manully trigger a change detection run ....
                    this.cdr.markForCheck();
                })
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
}