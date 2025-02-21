import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, model, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatAutocompleteModule } from "@angular/material/autocomplete";
import { Timestamp } from "@bufbuild/protobuf";
import { CKEditorModule } from "@ckeditor/ckeditor5-angular";
import { ConnectError } from "@connectrpc/connect";
import { lucideCalendar, lucideClock } from "@ng-icons/lucide";
import { BrnAlertDialogModule } from "@spartan-ng/ui-alertdialog-brain";
import { BrnDialogRef, injectBrnDialogContext } from "@spartan-ng/ui-dialog-brain";
import { BrnSelectModule } from "@spartan-ng/ui-select-brain";
import { HlmAlertDialogModule } from "@tierklinik-dobersberg/angular/alertdialog";
import { injectUserProfiles, sortProtoTimestamps } from "@tierklinik-dobersberg/angular/behaviors";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { injectCalendarService, injectCallService } from "@tierklinik-dobersberg/angular/connect";
import { HlmDialogDescriptionDirective, HlmDialogFooterComponent, HlmDialogHeaderComponent, HlmDialogService, HlmDialogTitleDirective } from '@tierklinik-dobersberg/angular/dialog';
import { HlmIconModule, provideIcons } from "@tierklinik-dobersberg/angular/icon";
import { HlmInputDirective } from "@tierklinik-dobersberg/angular/input";
import { ToDatePipe } from "@tierklinik-dobersberg/angular/pipes";
import { HlmSelectModule } from "@tierklinik-dobersberg/angular/select";
import { HlmTableComponent, HlmTdComponent, HlmThComponent, HlmTrowComponent } from '@tierklinik-dobersberg/angular/table';
import { Duration } from "@tierklinik-dobersberg/angular/utils/date";
import { DurationValidatorDirective } from "@tierklinik-dobersberg/angular/validators";
import { Calendar, CalendarEvent, CreateEventRequest, MoveEventRequest, UpdateEventRequest, UpdateEventResponse } from "@tierklinik-dobersberg/apis/calendar/v1";
import { CallStatus } from "@tierklinik-dobersberg/apis/pbx3cx/v1";
import { Markdown } from "ckeditor5";
import { addMinutes, addSeconds } from "date-fns";
import { toast } from "ngx-sonner";
import { catchError, defer, retry, take, throwError } from "rxjs";
import { config, MyEditor } from "src/app/ckeditor";
import { AppAvatarComponent } from "src/app/components/avatar";
import { TkdDatePickerComponent } from "src/app/components/date-picker";
import { getCalendarId } from "src/app/services";
import { getSeconds } from "../../pages/calendar2/day-view/sort.pipe";
import { DIALOG_CONTENT_CLASS } from "../constants";
import { CreateCustomerDialog } from "../create-customer-dialog";

export interface EventDetailsDialogContext {
        event?: CalendarEvent,
        calendar: Calendar,
        startTime?: Date,
}

interface RecentCall {
    caller: string;
    name: string;
    unknown: boolean;
}

@Component({
    standalone: true,
    imports:[
        HlmDialogHeaderComponent,
        HlmDialogDescriptionDirective,
        HlmDialogTitleDirective,
        HlmDialogFooterComponent,
        HlmButtonDirective,
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
        BrnAlertDialogModule,
        HlmAlertDialogModule,
        CKEditorModule,
        MatAutocompleteModule
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
    private readonly _callService = injectCallService();
    private readonly _dialogService = inject(HlmDialogService)

    protected readonly editor = MyEditor;
    protected readonly config = (() => {
        return {
            ...config,
            plugins: config.plugins.filter(p => p !== Markdown)
        }
    })()

    protected readonly recentCalls = signal<RecentCall[]>([]);

    protected event = this._dialogContext.event;
    protected readonly calendar = this._dialogContext.calendar;
    protected readonly user = computed(() => {
        const profiles = this.profiles();

        return profiles.find(p => getCalendarId(p) === this.calendar.id);
    })
    protected readonly edit = signal(false);
    protected readonly isNew = signal(false);
    
    protected readonly availableCalendars = signal<Calendar[]>([]);

    protected readonly calendarId = model<string>('');
    protected readonly summary = model<string>('');
    protected readonly description = model<string>('');
    protected readonly date = model<string>('');
    protected readonly startTime = model<Date>();
    protected readonly duration = model<string>('');
    protected readonly createTime = model<Date | null>(null);

    static open(service: HlmDialogService, ctx: EventDetailsDialogContext): BrnDialogRef<AppEventDetailsDialogComponent> {
        return service.open(AppEventDetailsDialogComponent, {
            context: ctx,
            contentClass: DIALOG_CONTENT_CLASS,
        })
    }

    ngOnInit() {
        if (this.event && !this.event.isFree) {
            this.calendarId.set(this.event.calendarId);
            this.summary.set(this.event.summary);
            this.description.set(this.event.description)
            this.startTime.set(this.event.startTime.toDate());
            this.duration.set(Duration.seconds(getSeconds(this.event.endTime) - getSeconds(this.event.startTime)).toString());
            this.createTime.set(this.event.createTime?.toDate() || null)
        } else {
            this.duration.set("15m")
            this.edit.set(true);
            this.isNew.set(true);
            this.createTime.set(null);

            const now = new Date();
            const before = addMinutes(now, -5)

            this._callService
                .searchCallLogs({
                    timeRange: {
                        from: Timestamp.fromDate(before),
                        to: Timestamp.fromDate(now)
                    }
                })
                .then(response => {
                    console.log(response.results);

                    const logs = response.results
                        .filter(record => [CallStatus.INBOUND, CallStatus.OUTBOUND, CallStatus.UNSPECIFIED].includes(record.status))
                        .sort((a, b) => sortProtoTimestamps(b.receivedAt, a.receivedAt))
                        .map(record => {
                            const customer = response.customers.find(c => c.id === record.customerId)
                            if (!customer) {
                                return <RecentCall>{
                                    caller: record.caller,
                                    name: 'Neuer Kunde: ' + record.caller,
                                    unknown: true
                                }
                            }

                            return <RecentCall>{
                                caller: record.caller,
                                name: `${customer.lastName} ${customer.firstName}`
                            }
                        })

                    const m = new Map<string, RecentCall>();
                    logs.forEach(l => m.set(l.caller, l))

                    this.recentCalls.set(Array.from(m.values()))
                       
                })
                .catch(err => {
                    console.error(err)
                })

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

    protected handleRecentCallClick(call: RecentCall) {
        if (call.unknown) {
            CreateCustomerDialog.open(this._dialogService, {
                caller: call.caller,
            })
                .closed$
                .pipe(take(1))
                .subscribe(customer => {
                    if (!customer) {
                        return
                    }

                    this.summary.set(customer.lastName + ' ' + customer.firstName)
                })


        } else {
            this.summary.set(call.name)
        }
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

        if (req.updateMask.paths.length > 0) {
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
        }
        
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
