import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";
import { lucideSearch, lucideTrash2 } from "@ng-icons/lucide";
import { BrnCommandModule } from "@spartan-ng/ui-command-brain";
import { BrnPopoverModule } from "@spartan-ng/ui-popover-brain";
import { HlmBadgeDirective } from "@tierklinik-dobersberg/angular/badge";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { HlmCommandModule } from "@tierklinik-dobersberg/angular/command";
import { HlmIconComponent, provideIcons } from "@tierklinik-dobersberg/angular/icon";
import { HlmPopoverModule } from "@tierklinik-dobersberg/angular/popover";
import { Board, Task } from "@tierklinik-dobersberg/apis/tasks/v1";
import { ContrastColorPipe } from "src/app/pipes/contrast-color.pipe";
import { TaskPriorityPipe } from "../color.pipe";

@Component({
    selector: 'app-task-priority',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './task-priority.html',
    imports: [
        HlmBadgeDirective,
        HlmCommandModule,
        BrnCommandModule,
        HlmPopoverModule,
        BrnPopoverModule,
        HlmButtonDirective,
        TaskPriorityPipe,
        ContrastColorPipe,
        HlmIconComponent
    ],
    providers: [
        ...provideIcons({lucideSearch, lucideTrash2})
    ]
})
export class TaskPriorityComponent {
    public readonly task = input.required<Task>();
    public readonly board = input.required<Board>();

    public readonly switch = output<number>();
}