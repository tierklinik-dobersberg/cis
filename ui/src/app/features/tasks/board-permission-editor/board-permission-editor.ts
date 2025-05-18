import { Component, input, model, signal } from "@angular/core";
import { lucideTrash2 } from "@ng-icons/lucide";
import { BrnSeparatorComponent } from "@spartan-ng/ui-separator-brain";
import { BrnTabsModule } from "@spartan-ng/ui-tabs-brain";
import { injectUserProfiles } from "@tierklinik-dobersberg/angular/behaviors";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { injectRoleService } from "@tierklinik-dobersberg/angular/connect";
import { HlmIconModule, provideIcons } from "@tierklinik-dobersberg/angular/icon";
import { HlmSeparatorDirective } from "@tierklinik-dobersberg/angular/separator";
import { HlmTableModule } from "@tierklinik-dobersberg/angular/table";
import { HlmTabsModule } from "@tierklinik-dobersberg/angular/tabs";
import { Profile, Role } from "@tierklinik-dobersberg/apis/idm/v1";
import { BoardPermission } from "@tierklinik-dobersberg/apis/tasks/v1";
import { AppAvatarComponent } from "src/app/components/avatar";
import { SelectionSheet, SelectionSheetItemDirective } from "src/app/dialogs/selection-sheet";
import { ToRolePipe } from "src/app/pipes/to-role.pipe";

@Component({
    standalone: true,
    selector: 'app-board-permission-editor',
    templateUrl: './board-permission-editor.html',
    imports: [
        HlmTableModule,
        SelectionSheet,
        SelectionSheetItemDirective,
        AppAvatarComponent,
        HlmTabsModule,
        BrnTabsModule,
        BrnSeparatorComponent,
        HlmButtonDirective,
        HlmSeparatorDirective,
        HlmIconModule,
        ToRolePipe,
    ],
    providers: [
        ...provideIcons({lucideTrash2})
    ]
})
export class BoardPermissionEditorComponent {
    private readonly roleService = injectRoleService();

    protected readonly profiles = injectUserProfiles();
    protected readonly roles = signal<Role[]>([]);

    public readonly title = input.required();

    public readonly permissions = model<BoardPermission>(new BoardPermission());

    protected allowUser(profile: Profile) {
        const perm = (this.permissions() || new BoardPermission).clone();

        perm.allowUsers = [
            ...(perm.allowUsers || []),
            profile.user.id,
        ]

        this.permissions.set(perm)
    }

    protected allowRole(role: Role) {
        const perm = (this.permissions() || new BoardPermission).clone();

        perm.allowRoles = [
            ...(perm.allowRoles || []),
            role.id,
        ]

        this.permissions.set(perm)
    }

    protected denyUser(profile: Profile) {
        const perm = (this.permissions() || new BoardPermission).clone()

        perm.denyUsers = [
            ...(perm.denyUsers || []),
            profile.user.id,
        ]

        this.permissions.set(perm)
    }

    protected denyRole(role: Role) {
        const perm = (this.permissions() || new BoardPermission).clone()

        perm.denyRoles = [
            ...(perm.denyRoles || []),
            role.id,
        ]

        this.permissions.set(perm)
    }

    protected deleteListEntry(list: any[], idx: number) {
        list.splice(idx, 1)

        this.permissions.set(this.permissions().clone())
    }

    constructor() {
        this.roleService
            .listRoles({})
            .then(response => this.roles.set(response.roles));
    }
}