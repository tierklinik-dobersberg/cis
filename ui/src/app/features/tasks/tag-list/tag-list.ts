import { AfterViewInit, booleanAttribute, ChangeDetectionStrategy, Component, input, output } from "@angular/core";
import { lucideCheck, lucideChevronDown, lucideLayers, lucideSearch } from "@ng-icons/lucide";
import { BrnCommandModule } from "@spartan-ng/ui-command-brain";
import { BrnPopoverModule } from "@spartan-ng/ui-popover-brain";
import { HlmBadgeDirective } from "@tierklinik-dobersberg/angular/badge";
import { HlmCommandModule } from "@tierklinik-dobersberg/angular/command";
import { HlmIconModule, provideIcons } from "@tierklinik-dobersberg/angular/icon";
import { HlmLabelDirective } from "@tierklinik-dobersberg/angular/label";
import { HlmPopoverModule } from "@tierklinik-dobersberg/angular/popover";
import { Board, Task } from "@tierklinik-dobersberg/apis/tasks/v1";
import { ContrastColorPipe } from "src/app/pipes/contrast-color.pipe";
import { TagColorPipe } from "../color.pipe";
import { ResizableComponentWidth } from "../utils";

@Component({
    selector: 'app-tag-list',
    standalone: true,
    templateUrl: './tag-list.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        HlmPopoverModule,
        BrnPopoverModule,
        HlmCommandModule,
        BrnCommandModule,
        TagColorPipe,
        ContrastColorPipe,
        HlmIconModule,
        HlmBadgeDirective,
        HlmLabelDirective,
    ],
    providers: [
        ...provideIcons({lucideSearch, lucideChevronDown, lucideLayers, lucideCheck})
    ]
})
export class TagListComponent extends ResizableComponentWidth implements AfterViewInit {
    public readonly task = input.required<Task>();
    public readonly board = input.required<Board>();
    public readonly readonly = input(false, {transform: booleanAttribute})
    
    public readonly toggleTag = output<string>();
}