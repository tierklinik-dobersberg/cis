import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, effect, ElementRef, inject, input, output, Renderer2, signal } from "@angular/core";
import { PartialMessage } from "@bufbuild/protobuf";
import { CKEditorModule } from "@ckeditor/ckeditor5-angular";
import { ConnectError } from "@connectrpc/connect";
import { lucideCalendar, lucideCalendarCheck, lucideCheck, lucideCheckCheck, lucideCircleDollarSign, lucideCircleDot, lucideClock, lucideMoreVertical, lucideTags, lucideTrash2, lucideUser, lucideUser2, lucideX } from "@ng-icons/lucide";
import { BrnSeparatorComponent } from "@spartan-ng/ui-separator-brain";
import { injectCurrentProfile, injectUserProfiles } from "@tierklinik-dobersberg/angular/behaviors";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { injectBoardService, injectTaskService } from "@tierklinik-dobersberg/angular/connect";
import { HlmIconModule, provideIcons } from "@tierklinik-dobersberg/angular/icon";
import { HlmInputDirective } from "@tierklinik-dobersberg/angular/input";
import { HlmLabelDirective } from "@tierklinik-dobersberg/angular/label";
import { DisplayNamePipe, ToDatePipe, ToUserPipe } from "@tierklinik-dobersberg/angular/pipes";
import { HlmSeparatorDirective } from "@tierklinik-dobersberg/angular/separator";
import { HlmTableModule } from "@tierklinik-dobersberg/angular/table";
import { Task, Board } from '@tierklinik-dobersberg/apis/tasks/v1'
import { MarkdownModule } from "ngx-markdown";
import { toast } from "ngx-sonner";
import { injectCurrentConfig } from "src/app/api";
import { AppAvatarComponent } from "src/app/components/avatar";
import { StatusColorPipe, TagColorPipe } from "../color.pipe";
import { HlmBadgeDirective } from "@tierklinik-dobersberg/angular/badge";
import { ContrastColorPipe } from "src/app/pipes/contrast-color.pipe";
import { Renderer } from "ckeditor5";

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
        AppAvatarComponent,
        TagColorPipe,
        HlmBadgeDirective,
        StatusColorPipe,
        ContrastColorPipe,
        HlmTableModule
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
            lucideCalendarCheck,
            lucideCircleDot,
            lucideX,
        }),
    ],
    styles: [
        `
        :host {
            @apply transform translate-x-full transition duration-100 ease-in-out;
        }
        `
    ]
})
export class TaskDetailsComponent {
    public readonly task = input.required<Task>()
    public readonly board = input.required<Board>()

    public readonly close = output<void>();

    protected readonly currentProfile = injectCurrentProfile();
    protected readonly profiles = injectUserProfiles();
    protected readonly config = injectCurrentConfig();

    private readonly element = inject(ElementRef)
    private readonly renderer = inject(Renderer2);
    private readonly taskService = injectTaskService();
    private readonly boardService = injectBoardService();

    constructor() {
        setTimeout(() => {
            this.renderer.addClass(this.element.nativeElement, '!translate-x-0')
        }, 1)
    }

    protected startClose() {
            this.renderer.removeClass(this.element.nativeElement, '!translate-x-0')
            setTimeout(() => {
                this.close.emit();
            }, 100)
    }
}