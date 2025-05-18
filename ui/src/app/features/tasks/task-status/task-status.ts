import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";
import { lucideChevronDown, lucideSearch, lucideTrash2 } from "@ng-icons/lucide";
import { BrnCommandModule } from "@spartan-ng/ui-command-brain";
import { BrnPopoverModule } from "@spartan-ng/ui-popover-brain";
import { HlmBadgeDirective } from "@tierklinik-dobersberg/angular/badge";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { HlmCommandModule } from "@tierklinik-dobersberg/angular/command";
import { HlmIconComponent, provideIcons } from "@tierklinik-dobersberg/angular/icon";
import { HlmLabelDirective } from "@tierklinik-dobersberg/angular/label";
import { HlmPopoverModule } from "@tierklinik-dobersberg/angular/popover";
import { Board, Task } from "@tierklinik-dobersberg/apis/tasks/v1";
import { ContrastColorPipe } from "src/app/pipes/contrast-color.pipe";
import { StatusColorPipe } from "../color.pipe";
import { ResizableComponentWidth } from "../utils";

@Component({
    selector: 'app-task-status',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './task-status.html',
    imports: [
        HlmBadgeDirective,
        HlmCommandModule,
        BrnCommandModule,
        HlmPopoverModule,
        BrnPopoverModule,
        HlmButtonDirective,
        StatusColorPipe,
        HlmLabelDirective,
        ContrastColorPipe,
        HlmIconComponent
    ],
    providers: [
        ...provideIcons({lucideSearch, lucideTrash2, lucideChevronDown})
    ]
})
export class TaskStatusComponent extends ResizableComponentWidth {
    public readonly task = input.required<Task>();
    public readonly board = input.required<Board>();

    public readonly switch = output<string>();
}