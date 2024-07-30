import { DatePipe } from "@angular/common";
import { booleanAttribute, ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from "@angular/core";
import { Duration } from "@bufbuild/protobuf";
import { ConnectError } from "@connectrpc/connect";
import { lucideCheckCircle } from "@ng-icons/lucide";
import { BrnTooltipModule } from "@spartan-ng/ui-tooltip-brain";
import { injectUserProfiles } from "@tierklinik-dobersberg/angular/behaviors";
import { injectCalendarService } from "@tierklinik-dobersberg/angular/connect";
import { HlmDialogService } from "@tierklinik-dobersberg/angular/dialog";
import { HlmIconModule, provideIcons } from "@tierklinik-dobersberg/angular/icon";
import { DurationPipe, ToDatePipe } from "@tierklinik-dobersberg/angular/pipes";
import { HlmSkeletonComponent } from "@tierklinik-dobersberg/angular/skeleton";
import { HlmTooltipModule } from "@tierklinik-dobersberg/angular/tooltip";
import { Duration as TkdDuration } from '@tierklinik-dobersberg/angular/utils/date';
import { Calendar, CalendarEvent, ListCalendarsResponse, Profile } from "@tierklinik-dobersberg/apis";
import { isAfter, isBefore } from "date-fns";
import { toast } from "ngx-sonner";
import { getSeconds } from "src/app/pages/calendar2/day-view/sort.pipe";
import { getCalendarId } from "src/app/services";
import { sortCalendarEvents } from "src/app/utils/calendar/sorting";
import { UserColorVarsDirective } from "../user-color-vars";

class EventListModel extends CalendarEvent {
    public readonly isOver: boolean;
    public readonly duration: Duration;
    public readonly isNow: boolean;
    public readonly classes: string;

    constructor(ev: EventModel, public readonly calendar: Calendar, public readonly profile?: Profile) {
        super(ev);

        const now = new Date();
        this.isOver = isBefore(ev.endTime.toDate(), now);
        this.isNow = isBefore(ev.startTime.toDate(), now) && isAfter(ev.endTime?.toDate(), now);
        this.duration = TkdDuration.seconds(getSeconds(ev.endTime) - getSeconds(ev.startTime)).toProto();
        this.classes = ev.classes || '';
    }
}

export type EventModel = CalendarEvent & {
    classes?: string;
}


@Component({
    selector: 'app-event-list',
    standalone: true,
    templateUrl: './event-list.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ToDatePipe,
        DatePipe,
        UserColorVarsDirective,
        HlmIconModule,
        DurationPipe,
        HlmTooltipModule,
        BrnTooltipModule,
        HlmSkeletonComponent,
    ],
    host: {
        'class': 'block',
    },
    providers: [
        ...provideIcons({lucideCheckCircle})
    ]
})
export class AppEventListComponent {
    private readonly calendarService = injectCalendarService();
    private readonly profiles = injectUserProfiles();
    private readonly dialogService = inject(HlmDialogService);
    
    /** Emits whenever a details dialog of a calendar event has been closed */
    public readonly detailsClosed = output<EventListModel>();

    /** The events to display */
    public readonly events = input.required<EventModel[]>()

    /** Whether or not the parent component is still loading events */
    public readonly loading = input(false, {transform: booleanAttribute});

    /** Whether or not only upcoming events are shown */
    public readonly onlyUpcoming = input(true, { transform: booleanAttribute })

    /** A list of all available calendars */
    protected readonly calendars = signal<Calendar[]>([]);

    /** The final enriched and filtered event models */
    protected readonly _computedEvents = computed(() => {
        const events = this.events();
        const calendars = this.calendars();
        const profiles = this.profiles();
        const upcoming = this.onlyUpcoming();

        return events
            .sort(sortCalendarEvents)
            .map(event => {
                const profile = profiles.find(p => getCalendarId(p) === event.calendarId)
                const calendar = calendars.find(cal => cal.id === event.calendarId)

                return new EventListModel(event, calendar, profile)
            })
            .filter(event => {
                if (upcoming && event.isOver) {
                    return false;
                }

                return true;
            })
    })

    protected openEvent(event: EventListModel) {
        import("../../dialogs/event-details-dialog")
            .then(m => {
                m.AppEventDetailsDialogComponent.open(this.dialogService, {
                    calendar: event.calendar,
                    event: event,
                })
                .closed$.subscribe(() => this.detailsClosed.emit(event));
            })
    }

    constructor() {
        this.calendarService
            .listCalendars({})
            .catch(err => {
                toast.error('Kalender konnten nicht geladen werden', {
                    description: ConnectError.from(err).message
                })

                return new ListCalendarsResponse()
            })
            .then(response => {
                this.calendars.set(response.calendars || []);
            })
    }
}