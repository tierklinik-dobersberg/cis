import { ChangeDetectionStrategy, Component, computed, inject, model, signal, WritableSignal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { ConnectError } from "@connectrpc/connect";
import { lucideTrash } from "@ng-icons/lucide";
import { BrnSeparatorComponent } from "@spartan-ng/ui-separator-brain";
import { BrnTabsModule } from "@spartan-ng/ui-tabs-brain";
import { injectUserProfiles } from "@tierklinik-dobersberg/angular/behaviors";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { HlmCardModule } from "@tierklinik-dobersberg/angular/card";
import { injectBoardService, injectRoleService } from "@tierklinik-dobersberg/angular/connect";
import { HlmIconModule, provideIcons } from "@tierklinik-dobersberg/angular/icon";
import { HlmInputDirective } from "@tierklinik-dobersberg/angular/input";
import { HlmLabelDirective } from "@tierklinik-dobersberg/angular/label";
import { HlmSeparatorDirective } from "@tierklinik-dobersberg/angular/separator";
import { HlmTableModule } from "@tierklinik-dobersberg/angular/table";
import { HlmTabsModule } from "@tierklinik-dobersberg/angular/tabs";
import { ListRolesResponse, Role } from "@tierklinik-dobersberg/apis/idm/v1";
import { Board, BoardPermission, CreateBoardRequest, GetBoardResponse, TaskPriority, TaskStatus, TaskTag, UpdateBoardRequest } from "@tierklinik-dobersberg/apis/tasks/v1";
import { NgxColorsModule } from 'ngx-colors';
import { toast } from "ngx-sonner";
import { BoardPermissionEditorComponent } from "../board-permission-editor/board-permission-editor";
import { FieldEditorComponent } from "./field-editor/field-editor";

enum Permission {
    Allow = "allow",
    Deny = "deny"
}

@Component({
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './manage-board.html',
    imports: [
        HlmTabsModule,
        BrnTabsModule,
        HlmTableModule,
        HlmCardModule,
        HlmLabelDirective,
        HlmInputDirective,
        FormsModule,
        HlmButtonDirective,
        BrnSeparatorComponent,
        HlmSeparatorDirective,
        HlmIconModule,
        BoardPermissionEditorComponent,
        NgxColorsModule,
        FieldEditorComponent,
    ],
    providers: [
        ...provideIcons({lucideTrash})
    ]
})
export class ManageBoardComponent {
    // Angular services

    private readonly route = inject(ActivatedRoute)
    private readonly router = inject(Router);

    // Connect services

    private readonly boardService = injectBoardService()
    private readonly roleService = injectRoleService();

    protected readonly tag = new TaskTag();
    protected readonly status = new TaskStatus();
    protected readonly priority = new TaskPriority();

    // Signals for available values

    protected readonly profiles = injectUserProfiles();
    protected readonly roles = signal<Role[]>([]);
    protected readonly existingBoard = signal<Board | null>(null);

    // Models

    protected readonly displayName = model('');
    protected readonly description = model('');
    protected readonly writePermissions = model<BoardPermission>(new BoardPermission())
    protected readonly readPermissions = model<BoardPermission>(new BoardPermission())

    protected readonly tags = model<TaskTag[]>([]);
    protected readonly statuses = model<TaskStatus[]>([]);
    protected readonly priorities = model<TaskPriority[]>([]);
    
    protected readonly initialStatus = model<TaskStatus | null>(null);
    protected readonly doneStatus = model<TaskStatus | null>(null);

    protected readonly _computedBoardModel = computed(() => {
        return new Board({
            displayName: this.displayName(),
            description: this.description(),
            readPermission: this.readPermissions(),
            writePermission: this.writePermissions(),
            allowedTaskStatus: this.statuses().filter(s => s.status !== ''),
            allowedTaskTags: this.tags().filter(t => t.tag !== ''),
            allowedTaskPriorities: this.priorities().filter(t => t.name !== ''),
            doneStatus: this.doneStatus()?.status,
            initialStatus: this.initialStatus()?.status,
        })
    })

    protected readonly _computedUpdateModel = computed(() => {
        const board = this._computedBoardModel();
        const existing = this.existingBoard();

        if  (!existing) {
            return new CreateBoardRequest(board)
        }

        let req = new UpdateBoardRequest({
            boardId: existing.id,
            kind: {
                case: 'list',
                value: {}
            },
            updateMask: {
                paths: []
            }
        })

        if (JSON.stringify(board.allowedTaskStatus) !== JSON.stringify(existing.allowedTaskStatus)) {
            req.allowedTaskStatus = board.allowedTaskStatus;
            req.updateMask.paths.push("allowed_task_status")
        }

        if (JSON.stringify(board.allowedTaskTags) !== JSON.stringify(existing.allowedTaskTags)) {
            req.allowedTaskTags = board.allowedTaskTags;
            req.updateMask.paths.push("allowed_task_tags")
        }

        if (JSON.stringify(board.allowedTaskPriorities) !== JSON.stringify(existing.allowedTaskPriorities)) {
            req.allowedTaskPriorities = board.allowedTaskPriorities;
            req.updateMask.paths.push("allowed_task_priorities")
        }
        
        if (board.initialStatus !== existing.initialStatus) {
            req.initialStatus = board.initialStatus;
            req.updateMask.paths.push('initial_status')
        }
        
        if (board.doneStatus !== existing.doneStatus) {
            req.doneStatus = board.doneStatus
            req.updateMask.paths.push('done_status')
        }

        if (board.displayName !== existing.displayName) {
            req.displayName = board.displayName
            req.updateMask.paths.push("display_name")
        }

        if (board.description !== existing.description) {
            req.description = board.description
            req.updateMask.paths.push("description")
        }

        if (!board.readPermission.equals(existing.readPermission)) {
            req.readPermission = board.readPermission;
            req.updateMask.paths.push("read_permission")
        }

        if (!board.writePermission.equals(existing.writePermission)) {
            req.writePermission = board.writePermission;
            req.updateMask.paths.push("write_permission")
        }

        return req
    })

    constructor() {
        this.roleService
            .listRoles({})
            .catch(err => {
                toast.error('Rollen konnten nicht geladen werden', {
                    description: ConnectError.from(err).message
                })

                return new ListRolesResponse
            })
            .then(response => this.roles.set(response.roles))

        this.route
            .paramMap
            .pipe(takeUntilDestroyed())
            .subscribe(params => {
                const boardId = params.get("boardId")
                if (boardId) {
                    this.boardService
                        .getBoard({id: boardId})
                        .catch(err => {
                            toast.error('Task-Board konnte nicht geladen werden', {
                                description: ConnectError.from(err).message
                            })

                            return new GetBoardResponse({
                                board: new Board()
                            })
                        })
                        .then(response => {
                            this.existingBoard.set(response.board.clone());

                            this.applyBoard(response.board)
                        })
                } else {
                    this.applyBoard(new Board())
                }
            })

    }

    protected removeRoleFromList(list: string[], role: Role) {
        const l = list.filter(r => r !== role.id)
        
    }

    protected update(signal: WritableSignal<any[]>) {
        console.log("updating values from ", signal())
        signal.set([...(signal() || [])]);
    }

    protected save() {
        const req = this._computedUpdateModel();

        if (req instanceof CreateBoardRequest) {
            this.boardService
                .createBoard(req)
                .then(res => {
                    toast.success('Task-Board wurde erfolgreich erstellt')
                    this.router.navigate(['/tasks', res.board.id])
                })
                .catch( err => {
                    toast.error('Task-Board konnte nicht erstellt werden', {
                        description: ConnectError.from(err).message
                    })
                })
        } else {
            if (!req.updateMask || !req.updateMask.paths?.length) {
                this.router.navigate(['/tasks', req.boardId])
                return;
            }

            this.boardService
                .updateBoard(req)
                .then(res => {
                    toast.success('Task-Board wurde erfolgreich gespeichert')
                    this.router.navigate(['/tasks', res.board.id])
                })
                .catch( err => {
                    toast.error('Task-Board konnte nicht gespeichert werden', {
                        description: ConnectError.from(err).message
                    })
                })
        }
    }

    private applyBoard(board: Board) {
        this.displayName.set(board.displayName)
        this.description.set(board.description)
        this.writePermissions.set(board.writePermission || new BoardPermission)
        this.readPermissions.set(board.readPermission || new BoardPermission)
        this.tags.set(board.allowedTaskTags || [])
        this.statuses.set(board.allowedTaskStatus || [])
        this.priorities.set(board.allowedTaskPriorities)
    }
}