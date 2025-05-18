import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { BrnTooltipModule } from "@spartan-ng/ui-tooltip-brain";
import { HlmBadgeDirective } from "@tierklinik-dobersberg/angular/badge";
import { injectUserProfiles } from "@tierklinik-dobersberg/angular/behaviors";
import { ToDatePipe, ToUserPipe, UserColorPipe } from "@tierklinik-dobersberg/angular/pipes";
import { HlmTooltipModule } from "@tierklinik-dobersberg/angular/tooltip";
import { Board, TaskTimelineEntry } from "@tierklinik-dobersberg/apis/tasks/v1";
import { AppAvatarComponent } from "src/app/components/avatar";
import { ContrastColorPipe } from "src/app/pipes/contrast-color.pipe";
import { ToJsonPipe } from "src/app/pipes/to-json.pipe";
import { StatusColorPipe, TagColorPipe, TaskPriorityPipe } from "../color.pipe";
import { TaskCommentComponent } from "../task-comment/task-comment";

@Component({
    selector: 'app-timeline-entry',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './timeline-entry.html',
    imports: [
        HlmBadgeDirective,
        ToUserPipe,
        UserColorPipe,
        AppAvatarComponent,
        ToDatePipe,
        DatePipe,
        TaskPriorityPipe,
        HlmTooltipModule,
        BrnTooltipModule,
        StatusColorPipe,
        TagColorPipe,
        ContrastColorPipe,
        TaskCommentComponent,
        ToJsonPipe
    ]
})
export class TimelineEntryComponent {
    public readonly entry = input.required<TaskTimelineEntry>();

    public readonly board = input.required<Board>();

    protected readonly profiles = injectUserProfiles();
}