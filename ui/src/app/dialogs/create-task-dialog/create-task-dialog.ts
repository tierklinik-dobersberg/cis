import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, model, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { PartialMessage, Timestamp } from "@bufbuild/protobuf";
import { CKEditorModule } from "@ckeditor/ckeditor5-angular";
import { ConnectError } from "@connectrpc/connect";
import { lucideCheck, lucideSearch, lucideX } from "@ng-icons/lucide";
import { BrnCommandModule } from '@spartan-ng/ui-command-brain';
import { BrnDialogRef, injectBrnDialogContext } from "@spartan-ng/ui-dialog-brain";
import { BrnPopoverModule } from "@spartan-ng/ui-popover-brain";
import { BrnSelectModule } from "@spartan-ng/ui-select-brain";
import { HlmBadgeDirective } from "@tierklinik-dobersberg/angular/badge";
import { injectUserProfiles } from "@tierklinik-dobersberg/angular/behaviors";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { HlmCommandModule } from '@tierklinik-dobersberg/angular/command';
import { injectBoardService, injectRoleService, injectTaskService } from "@tierklinik-dobersberg/angular/connect";
import { HlmDialogModule, HlmDialogService } from "@tierklinik-dobersberg/angular/dialog";
import { HlmIconModule, provideIcons } from "@tierklinik-dobersberg/angular/icon";
import { HlmInputDirective } from "@tierklinik-dobersberg/angular/input";
import { HlmLabelDirective } from "@tierklinik-dobersberg/angular/label";
import { HlmPopoverModule } from "@tierklinik-dobersberg/angular/popover";
import { HlmSelectModule } from "@tierklinik-dobersberg/angular/select";
import { ListRolesResponse, Role } from "@tierklinik-dobersberg/apis/idm/v1";
import { Board, GetBoardResponse, GetTaskResponse, Task, TaskTag, UpdateTaskRequest } from "@tierklinik-dobersberg/apis/tasks/v1";
import { isEqual } from "date-fns";
import { toast } from "ngx-sonner";
import { MyEditor } from "src/app/ckeditor";
import { TkdDatePickerComponent, TkdDatePickerInputDirective } from "src/app/components/date-picker";
import { TkdDatePickerTriggerComponent } from "src/app/components/date-picker/picker-trigger";
import { TagColorPipe } from "src/app/pages/tasks/color.pipe";
import { ContrastColorPipe } from "src/app/pipes/contrast-color.pipe";

export interface CreateTaskDialogContext {
    boardId: string;
    taskId?: string;
}

const contentClass =
      'w-screen overflow-hidden max-w-[unset] sm:w-[750px] md:w-[750px] h-[100dvh] sm:h-[unset] max-h-screen !max-h-[100dvh]';

@Component({
    standalone: true,
    templateUrl: './create-task-dialog.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        HlmDialogModule,
        HlmButtonDirective,
        HlmLabelDirective,
        HlmInputDirective,
        CKEditorModule,
        TkdDatePickerComponent,
        TkdDatePickerInputDirective,
        TkdDatePickerTriggerComponent,
        FormsModule,
        HlmIconModule,
        HlmSelectModule,
        HlmBadgeDirective,
        TagColorPipe,
        BrnSelectModule,
        ContrastColorPipe,
        BrnPopoverModule,
        HlmPopoverModule,
        BrnCommandModule,
        HlmCommandModule,
        DatePipe
    ],
    providers: [
        ...provideIcons({
            lucideX,
            lucideSearch,
            lucideCheck,
        })
    ]
})
export class EditTaskDialog {
    private readonly dialogRef = inject(BrnDialogRef<'success' | null>);
    private readonly dialogContext = injectBrnDialogContext<CreateTaskDialogContext>();
    private readonly boardService = injectBoardService();
    private readonly taskService = injectTaskService();
    private readonly rolseService = injectRoleService();

    protected readonly title = model('')
    protected readonly description = model('')
    protected readonly assigneeId = model<string | null>(null)
    protected readonly dueTime = model<Date | null>(null)
    protected readonly tags = model<string[]>([]);
    protected readonly status = model('');
    protected readonly createTime = model<Date | null>(null)

    protected readonly editor = MyEditor;

    protected readonly existingTask = signal<Task | null>(null)
    protected readonly profiles = injectUserProfiles();
    protected readonly roles = signal<Role[]>([]);
    protected readonly board = signal<Board>(new Board());
    protected readonly _computedAllowedStatusValues = computed(() => {
        return this.board().allowedTaskStatus;
    })

    static open(service: HlmDialogService, boardId: string, taskId?: string): BrnDialogRef<'success' | null> {
        return service.open(EditTaskDialog, {
            contentClass,
            context: {
                boardId,
                taskId,
            }
        })
    }

    constructor() {
        this.rolseService
            .listRoles({})
            .catch(err => {
                toast.error('Task-Board konnte nicht geladen werden', {
                    description: ConnectError.from(err).message
                })

                this.dialogRef.close(null);

                return new ListRolesResponse()
            })
            .then(response => this.roles.set(response.roles))

        this.boardService
            .getBoard({id: this.dialogContext.boardId})
            .catch(err => {
                toast.error('Task-Board konnte nicht geladen werden', {
                    description: ConnectError.from(err).message
                })

                this.dialogRef.close(null);

                return new GetBoardResponse()
            })
            .then(response => {
                this.board.set(response.board);
            })

        if (this.dialogContext.taskId) {
            this.taskService
                .getTask({taskId: this.dialogContext.taskId})
                .catch(err => {
                    toast.error('Task konnte nicht geladen werden', {
                        description: ConnectError.from(err).message
                    })

                    this.dialogRef.close(null);

                    return new GetTaskResponse()
                })
                .then(response => {
                    const t = response.task;

                    this.title.set(t.title)
                    this.description.set(t.description)
                    this.assigneeId.set(t.assigneeId || null)
                    this.tags.set(t.tags)
                    this.status.set(t.status)
                    this.createTime.set(t.createTime?.toDate() || null)

                    if (t.dueTime) {
                        this.dueTime.set(t.dueTime.toDate());
                    }

                    // keep the original task so we can calculate
                    // an appropriate update-mask
                    this.existingTask.set(t);
                })
        }
    }

    protected addTag(tag: string) {
        const l = [
            ...(this.tags() || []),
            tag
        ]

        this.tags.set(l);
    }

    protected deleteTag(tag: string) {
        this.tags.set(
            (this.tags() || []).filter(t => t !== tag)
        )
    }
    
    protected toggleTag(tag: TaskTag) {
        const has = this.tags()?.find(t => t === tag.tag);
        if (has) {
            this.deleteTag(tag.tag)
        } else {
            this.addTag(tag.tag);
        }
    }

    protected abort() {
        this.dialogRef.close(null);
    }

    protected save() {
        if (!this.existingTask()) {
            this.taskService
                .createTask({
                    boardId: this.board().id,
                    title: this.title(),
                    description: this.description(),
                    assigneeId: this.assigneeId() || undefined,
                    tags: this.tags(),
                    status: this.status(),
                    dueTime: this.dueTime() ? Timestamp.fromDate(this.dueTime()) : undefined,
                })
                .then(response => {
                    this.dialogRef.close('success')
                })
                .catch(err => {
                    toast.error('Task konnte nicht erstellt werden', {
                        description: ConnectError.from(err).message
                    })
                })
        } else {
            const t = this.existingTask();
            const paths: string[] = [];
            const req: PartialMessage<UpdateTaskRequest> = {
                taskId: t.id,
            }

            if (t.title !== this.title()) {
                req.title = this.title();
                paths.push("title")
            }

            if (t.description !== this.description()) {
                req.description = this.description()
                paths.push("description")
            }

            if (t.status !== this.status()) {
                req.status = this.status()
                paths.push("status")
            }

            if ((!!t.assigneeId || !!this.assigneeId()) && t.assigneeId !== this.assigneeId()) {
                req.assigneeId = this.assigneeId()
                paths.push("assignee_id")
            }

            if (!isEqual(t.dueTime?.toDate(), this.dueTime())) {
                paths.push("due_time")

                if (this.dueTime()) {
                    req.dueTime = Timestamp.fromDate(this.dueTime())
                }
            }

            const newTagSet = new Set(this.tags())
            const oldTagSet = new Set(t.tags)

            const newTags = this.tags()
                .filter(t => !oldTagSet.has(t))
            const removedTags = t.tags
                .filter(t => !newTagSet.has(t))

            if (newTags.length > 0 && removedTags.length > 0) {
                req.tags = {
                    case: 'replaceTags',
                    value: {
                        values: this.tags(),
                    }
                }
            } else if (newTags.length > 0) {
                req.tags = {
                    case: 'addTags',
                    value: {
                        values: newTags,
                    }
                }
            } else if (removedTags.length > 0) {
                req.tags = {
                    case: 'deleteTags',
                    value: {
                        values: removedTags,
                    }
                }
            }

            if (req.tags) {
                paths.push("tags")
            }

            if (paths.length === 0) {
                this.dialogRef.close(null);
                return
            }

            req.updateMask = {
                paths,
            }

            this.taskService
                .updateTask(req)
                .then(() => {
                    this.dialogRef.close('success')
                })
                .catch(err => {
                    toast.error('Tasks konnte nicht gespeichert werden', {
                        description: ConnectError.from(err).message
                    })
                })
        }
    }
}