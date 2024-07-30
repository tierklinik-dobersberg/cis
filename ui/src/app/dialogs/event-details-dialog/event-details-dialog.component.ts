import { DatePipe, NgClass } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, model, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Timestamp } from "@bufbuild/protobuf";
import { CKEditorModule } from "@ckeditor/ckeditor5-angular";
import { ConnectError } from "@connectrpc/connect";
import { lucideCalendar, lucideClock } from "@ng-icons/lucide";
import { BrnAlertDialogModule } from "@spartan-ng/ui-alertdialog-brain";
import { BrnDialogRef, injectBrnDialogContext } from "@spartan-ng/ui-dialog-brain";
import { BrnSelectModule } from "@spartan-ng/ui-select-brain";
import { HlmAlertDialogModule } from "@tierklinik-dobersberg/angular/alertdialog";
import { HlmBadgeDirective } from "@tierklinik-dobersberg/angular/badge";
import { injectUserProfiles } from "@tierklinik-dobersberg/angular/behaviors";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { injectCalendarService } from "@tierklinik-dobersberg/angular/connect";
import { HlmDialogDescriptionDirective, HlmDialogFooterComponent, HlmDialogHeaderComponent, HlmDialogService, HlmDialogTitleDirective } from '@tierklinik-dobersberg/angular/dialog';
import { HlmIconModule, provideIcons } from "@tierklinik-dobersberg/angular/icon";
import { HlmInputDirective } from "@tierklinik-dobersberg/angular/input";
import { DurationPipe, ToDatePipe } from "@tierklinik-dobersberg/angular/pipes";
import { HlmSelectModule } from "@tierklinik-dobersberg/angular/select";
import { HlmTableComponent, HlmTdComponent, HlmThComponent, HlmTrowComponent } from '@tierklinik-dobersberg/angular/table';
import { Duration } from "@tierklinik-dobersberg/angular/utils/date";
import { DurationValidatorDirective } from "@tierklinik-dobersberg/angular/validators";
import { Calendar, CalendarEvent, CreateEventRequest, MoveEventRequest, UpdateEventRequest, UpdateEventResponse } from "@tierklinik-dobersberg/apis";
import { Markdown } from "ckeditor5";
import { addSeconds } from "date-fns";
import { toast } from "ngx-sonner";
import { catchError, defer, retry, throwError } from "rxjs";
import { config, MyEditor } from "src/app/ckeditor";
import { AppAvatarComponent } from "src/app/components/avatar";
import { TkdDatePickerComponent } from "src/app/components/date-picker";
import { getCalendarId } from "src/app/services";
import { getSeconds } from "../../pages/calendar2/day-view/sort.pipe";

export interface EventDetailsDialogContext {
        event?: CalendarEvent,
        calendar: Calendar,
        startTime?: Date,
}

    const contentClass =
      'w-screen overflow-auto max-w-[unset] sm:w-[750px] md:w-[750px] h-[100dvh] sm:h-[unset] ';

@Component({
    standalone: true,
    imports:[
        HlmDialogHeaderComponent,
        HlmDialogDescriptionDirective,
        HlmDialogTitleDirective,
        HlmDialogFooterComponent,
        HlmButtonDirective,
        HlmBadgeDirective,
        HlmTableComponent,
        HlmThComponent,
        HlmTrowComponent,
        HlmTdComponent,
        ToDatePipe,
        DatePipe,
        HlmIconModule,
        AppAvatarComponent,
        BrnSelectModule,
        HlmSelectModule,
        FormsModule,
        HlmInputDirective,
        TkdDatePickerComponent,
        DurationValidatorDirective,
        DurationPipe,
        BrnAlertDialogModule,
        HlmAlertDialogModule,
        CKEditorModule,
        NgClass,
    ],
    providers: [
        ...provideIcons({lucideCalendar, lucideClock})
    ],
    templateUrl: './event-details-dialog.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    styles: [
        `
        :host {
            @apply flex flex-col h-full w-full overflow-hidden;
        }
        `
    ]
})
export class AppEventDetailsDialogComponent implements OnInit {
    private readonly profiles = injectUserProfiles();
    private readonly _calendarService = injectCalendarService();
    private readonly _dialogRef = inject<BrnDialogRef<unknown>>(BrnDialogRef);
    private readonly _dialogContext = injectBrnDialogContext<EventDetailsDialogContext>();

    protected readonly editor = MyEditor;
    protected readonly config = (() => {
        return {
            ...config,
            plugins: config.plugins.filter(p => p !== Markdown)
        }
    })()

    protected event = this._dialogContext.event;
    protected readonly calendar = this._dialogContext.calendar;
    protected readonly user = computed(() => {
        const profiles = this.profiles();

        return profiles.find(p => getCalendarId(p) === this.calendar.id);
    })
    protected readonly edit = signal(false);
    protected readonly isNew = signal(false);
    
    protected readonly availableCalendars = signal<Calendar[]>([]);

    protected calendarId = model<string>();
    protected summary = model<string>();
    protected description = model<string>();
    protected date = model<string>();
    protected startTime = model<Date>();
    protected duration = model<string>();

    static open(service: HlmDialogService, ctx: EventDetailsDialogContext): BrnDialogRef<AppEventDetailsDialogComponent> {
        return service.open(AppEventDetailsDialogComponent, {
            context: ctx,
            contentClass,
        })
    }

    ngOnInit() {
        if (this.event && !this.event.id.startsWith("break-")) {
            this.calendarId.set(this.event.calendarId);
            this.summary.set(this.event.summary);
            this.description.set(this.event.description)
            this.startTime.set(this.event.startTime.toDate());
            this.duration.set(Duration.seconds(getSeconds(this.event.endTime) - getSeconds(this.event.startTime)).toString());
        } else {
            this.duration.set("15m")
            this.edit.set(true);
            this.isNew.set(true);

            if (!this.event) {
                this.startTime.set(this._dialogContext.startTime)
                this.event = new CalendarEvent({});
                this.calendarId.set(this.calendar.id)

            } else {
                this.calendarId.set(this.event.calendarId);
                this.startTime.set(this.event.startTime.toDate());
            }
        }

        let errorMessageShown = false;
        defer(() => this._calendarService.listCalendars({}))
            .pipe(
                catchError(err => {
                    if (!errorMessageShown) {
                        errorMessageShown = true
                        toast.error('Kalendar konnte nicht geladen werden', {
                            description: ConnectError.from(err).message
                        })
                    }
                    
                    return throwError(() => err)
                }),
                retry({
                    delay: 2000,
                })
            )
            .subscribe(response => {
                this.availableCalendars.set(response.calendars);
            })
    }

    protected async create() {
        const req = new CreateEventRequest({
            calendarId: this.calendarId(),
            description: this.description(),
            start: Timestamp.fromDate(this.startTime()),
            end: Timestamp.fromDate(
                addSeconds(this.startTime(), Duration.parseString(this.duration()).seconds)
            ),
            name: this.summary()
        })
        
        await this._calendarService.createEvent(req)
            .catch(err => {
                toast.error('Termin konnte nicht erstellt werden', {
                    description: ConnectError.from(err).message,
                })
            })

        this.close();
    }
    
    protected async save() {
        const req = new UpdateEventRequest({
            calendarId: this.event.calendarId,
            eventId: this.event.id,
            updateMask: {
                paths: []
            }
        })

        if (this.event.description !== this.description()) {
            req.description = this.description();
            req.updateMask.paths.push('description')
        }
        
        if (this.event.summary !== this.summary()) {
            req.name = this.summary();
            req.updateMask.paths.push('name')
        }
        
        if (this.startTime().getTime() !== this.event.startTime.toDate().getTime()) {
            req.start = Timestamp.fromDate(this.startTime())
            req.updateMask.paths.push('start')
        }
        
        const duration = Duration.parseString(this.duration()).seconds;
        const oldDuration = getSeconds(this.event.endTime) - getSeconds(this.event.startTime);
        if (oldDuration !== duration) {
            req.end = Timestamp.fromDate( addSeconds(this.startTime(), duration ) )
            req.updateMask.paths.push('end')
        }
        
        const response = await this._calendarService
            .updateEvent(req)
            .catch(err => {
                toast.error('Termin konnte nicht gespeichert werden', {
                    description: ConnectError.from(err).message,
                })
                
                return new UpdateEventResponse({
                    event: this.event,
                })
            })
            
        this.event = response.event;
        
        if (this.event.calendarId !== this.calendarId()) {
            const response = await this._calendarService
                .moveEvent(new MoveEventRequest({
                    eventId: this.event.id,
                    source: {
                        case: 'sourceCalendarId',
                        value: this.event.calendarId,
                    },
                    target: {
                        case: 'targetCalendarId',
                        value: this.calendarId()
                    }
                }))
            .catch(err => {
                toast.error('Termin konnte nicht gespeichert werden', {
                    description: ConnectError.from(err).message,
                })
                
                return new UpdateEventResponse({
                    event: this.event,
                })
            })
                
            this.event = response.event;
        }
        
        this.edit.set(false);
    }
    
    protected close() {
        this._dialogRef.close();
    }
    
    protected async delete() {
        await this._calendarService
            .deleteEvent({calendarId: this.event.calendarId, eventId: this.event.id})
            
        this.close();
    }
}
