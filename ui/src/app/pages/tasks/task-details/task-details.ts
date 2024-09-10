import { DatePipe } from "@angular/common";
import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, effect, ElementRef, inject, Injector, output, signal, ViewChild } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { PartialMessage, Timestamp } from "@bufbuild/protobuf";
import { CKEditorModule } from "@ckeditor/ckeditor5-angular";
import { ConnectError } from "@connectrpc/connect";
import { lucideCalendarCheck, lucideCheck, lucideCheckCheck, lucideCircleDot, lucideClock, lucideLayers, lucideMoreVertical, lucideMove, lucideMoveHorizontal, lucideTags, lucideTrash2, lucideUser, lucideUser2, lucideX } from "@ng-icons/lucide";
import { BrnCommandModule } from "@spartan-ng/ui-command-brain";
import { BrnPopoverModule } from "@spartan-ng/ui-popover-brain";
import { BrnSeparatorComponent } from "@spartan-ng/ui-separator-brain";
import { BrnSheetContentDirective, BrnSheetTriggerDirective } from "@spartan-ng/ui-sheet-brain";
import { HlmBadgeDirective } from "@tierklinik-dobersberg/angular/badge";
import { injectCurrentProfile, injectUserProfiles } from "@tierklinik-dobersberg/angular/behaviors";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { HlmCommandModule } from "@tierklinik-dobersberg/angular/command";
import { injectBoardService, injectTaskService } from "@tierklinik-dobersberg/angular/connect";
import { HlmIconModule, provideIcons } from "@tierklinik-dobersberg/angular/icon";
import { HlmInputDirective } from "@tierklinik-dobersberg/angular/input";
import { HlmLabelDirective } from "@tierklinik-dobersberg/angular/label";
import { DisplayNamePipe, ToDatePipe, ToUserPipe } from "@tierklinik-dobersberg/angular/pipes";
import { HlmPopoverModule } from "@tierklinik-dobersberg/angular/popover";
import { HlmSeparatorDirective } from "@tierklinik-dobersberg/angular/separator";
import { HlmSheetComponent, HlmSheetModule } from "@tierklinik-dobersberg/angular/sheet";
import { HlmTableModule } from "@tierklinik-dobersberg/angular/table";
import { Board, BoardEvent, Task, TaskEvent, UpdateTaskRequest } from '@tierklinik-dobersberg/apis/tasks/v1';
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
import { StatusColorPipe, TagColorPipe } from "../color.pipe";

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
        TagColorPipe,
        HlmBadgeDirective,
        StatusColorPipe,
        ContrastColorPipe,
        CKEditorModule,
        HlmTableModule,
        BrnSheetTriggerDirective,
        HlmSheetModule,
        BrnSheetContentDirective,
        UserColorVarsDirective,
        RouterLink,
        BrnPopoverModule,
        TkdDatePickerComponent,
        TkdDatePickerInputDirective,
        HlmPopoverModule,
        BrnCommandModule,
        HlmCommandModule,
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
    private readonly taskService = injectTaskService();
    private readonly boardService = injectBoardService();
    private readonly cdr = inject(ChangeDetectorRef)

    protected readonly editTitle = signal(false);
    protected readonly editDescription = signal(false);

    protected readonly title = signal('');
    protected readonly description = signal('');

    @ViewChild(HlmSheetComponent, { static: true })
    protected sheet: HlmSheetComponent;

    @ViewChild(BrnSheetTriggerDirective, { static: true, read: ElementRef })
    protected triggerButton: ElementRef;

    public readonly closed = output<any>();

    toggleEditTitle() {
        const edit = this.editTitle();

        if (edit) {
            this.updateTask({title: this.title()})
        }

        this.editTitle.set(!edit)
    }

    toggleEditDescription() {
        const edit = this.editDescription();

        if (edit) {
            this.updateTask({description: this.description()})
        }

        this.editDescription.set(!edit)
    }

    ngAfterViewInit(): void {
        this.sheet.closed
            .subscribe(value => {
                this.closed.emit(value);
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

    protected updateDueTime(date?: Date) {
        this.updateTask({
            dueTime: date ? Timestamp.fromDate(date) : null,
        }, ['due_time'])
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

    protected deleteTask() {
        this.taskService
            .completeTask({taskId: this.task().id})
            .then(() => this.sheet.close(null))
            .catch(err => {
                toast.error('Task konnten nicht gelöscht werden', {
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

    constructor() {
        this.eventsService
            .listen([new BoardEvent, new TaskEvent])
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
                        this.task.set(msg.task);
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
                            this.cdr.markForCheck();
                        })
                        .catch( err => {
                            toast.error('Task konnte nicht geladen werden', {
                                description: ConnectError.from(err).message
                            })

                            this.sheet?.close(null);
                        })
                } else {
                    this.sheet?.close(null);
                }
            })

        effect(() => {
            const task = this.task();

            if (task && task.id && task.boardId) {
                setTimeout(() => {
                    this.triggerButton.nativeElement.click();
                }, 10)
            }
        }, { allowSignalWrites: true })
    }
}