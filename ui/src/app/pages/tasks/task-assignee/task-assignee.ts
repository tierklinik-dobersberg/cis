import { ChangeDetectionStrategy, Component, computed, input, output } from "@angular/core";
import { lucideChevronDown, lucideSearch, lucideTrash2, lucideUserCheck2 } from "@ng-icons/lucide";
import { BrnCommandModule } from "@spartan-ng/ui-command-brain";
import { BrnPopoverModule } from "@spartan-ng/ui-popover-brain";
import { HlmBadgeDirective } from "@tierklinik-dobersberg/angular/badge";
import { injectUserProfiles } from "@tierklinik-dobersberg/angular/behaviors";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { HlmCommandModule } from "@tierklinik-dobersberg/angular/command";
import { HlmIconComponent, provideIcons } from "@tierklinik-dobersberg/angular/icon";
import { HlmLabelDirective } from "@tierklinik-dobersberg/angular/label";
import { HlmPopoverModule } from "@tierklinik-dobersberg/angular/popover";
import { Board, Task } from "@tierklinik-dobersberg/apis/tasks/v1";
import { AppAvatarComponent } from "src/app/components/avatar";
import { ResizableComponentWidth } from "../utils";

@Component({
    selector: 'app-task-assignee',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './task-assignee.html',
    imports: [
        HlmBadgeDirective,
        HlmCommandModule,
        BrnCommandModule,
        HlmPopoverModule,
        BrnPopoverModule,
        HlmButtonDirective,
        AppAvatarComponent,
        HlmLabelDirective,
        HlmIconComponent
    ],
    providers: [
        ...provideIcons({lucideSearch, lucideTrash2, lucideChevronDown, lucideUserCheck2})
    ]
})
export class TaskAssigneeComponent extends ResizableComponentWidth {
    public readonly task = input.required<Task>();
    public readonly board = input.required<Board>();

    protected readonly profiles = injectUserProfiles();

    protected readonly eligibleProfiles = computed(() => {
        const profiles = this.profiles();
        const board = this.board();

        if (!board.eligibleRoleIds?.length && !board.eligibleUserIds?.length) {
            return profiles;
        }

        return profiles
            .filter(p => {
                if (board.eligibleUserIds?.includes(p.user.id)) {
                    return true
                }

                return board.eligibleRoleIds?.some(role => p.roles.some(r => r.id === role));
            }) 
    })

    public readonly switch = output<string>();
}