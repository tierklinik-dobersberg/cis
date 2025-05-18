import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { HlmBadgeDirective } from "@tierklinik-dobersberg/angular/badge";
import { ToDatePipe } from "@tierklinik-dobersberg/angular/pipes";
import { Board } from "@tierklinik-dobersberg/apis/tasks/v1";
import { AppAvatarComponent } from "src/app/components/avatar";
import { ContrastColorPipe } from "src/app/pipes/contrast-color.pipe";
import { StatusColorPipe, TagColorPipe, TaskPriorityPipe } from "../color.pipe";

@Component({
    selector: 'app-task-group-value',
    standalone: true,
    templateUrl: './group-value.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        HlmBadgeDirective,
        ContrastColorPipe,
        StatusColorPipe,
        TagColorPipe,
        AppAvatarComponent,
        ToDatePipe,
        DatePipe,
        TaskPriorityPipe,
    ],
    styles: [
        `
        :host {
            @apply flex flex-row gap-2 items-center;
        }
        `
    ]
})
export class TaskGroupValueComponent {
    public readonly value = input.required<any>();
    public readonly field = input.required<string>();
    public readonly board = input.required<Board>();
}