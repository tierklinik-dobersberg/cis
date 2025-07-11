import { DatePipe, NgClass } from "@angular/common";
import { booleanAttribute, ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from "@angular/core";
import { Duration } from "@bufbuild/protobuf";
import { ConnectError } from "@connectrpc/connect";
import { lucideCircleCheck } from "@ng-icons/lucide";
import { BrnTooltipModule } from "@spartan-ng/ui-tooltip-brain";
import { injectUserProfiles } from "@tierklinik-dobersberg/angular/behaviors";
import { injectCalendarService } from "@tierklinik-dobersberg/angular/connect";
import { HlmDialogService } from "@tierklinik-dobersberg/angular/dialog";
import { HlmIconModule, provideIcons } from "@tierklinik-dobersberg/angular/icon";
import { LayoutService } from "@tierklinik-dobersberg/angular/layout";
import { DurationPipe, ToDatePipe } from "@tierklinik-dobersberg/angular/pipes";
import { HlmSkeletonComponent } from "@tierklinik-dobersberg/angular/skeleton";
import { HlmTooltipModule } from "@tierklinik-dobersberg/angular/tooltip";
import { Duration as TkdDuration } from '@tierklinik-dobersberg/angular/utils/date';
import { Calendar, CalendarEvent, ListCalendarsResponse } from "@tierklinik-dobersberg/apis/calendar/v1";
import { Profile } from "@tierklinik-dobersberg/apis/idm/v1";
import { isAfter, isBefore } from "date-fns";
import { toast } from "ngx-sonner";
import { getSeconds } from "src/app/features/calendar2/day-view/sort.pipe";
import { getCalendarId } from "src/app/services";
import { sortCalendarEvents } from "src/app/utils/calendar/sorting";
import { AppAvatarComponent } from "../avatar";
import { UserColorVarsDirective } from "../user-color-vars";

class EventListModel extends CalendarEvent {
    public readonly isOver: boolean;
    public readonly duration: Duration;
    public readonly isNow: boolean;
    public readonly uniqueId: string;

    constructor(ev: CalendarEvent, public readonly calendar: Calendar, public readonly profile?: Profile) {
        super(ev);

        const now = new Date();
        this.isOver = isBefore(ev.endTime.toDate(), now);
        this.isNow = isBefore(ev.startTime.toDate(), now) && isAfter(ev.endTime?.toDate(), now);
        this.duration = TkdDuration.seconds(getSeconds(ev.endTime) - getSeconds(ev.startTime)).toProto();
        this.uniqueId = calendar.id + ':' + ev.id;
    }
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
        AppAvatarComponent,
        NgClass
    ],
    host: {
        'class': 'block',
    },
    providers: [
        ...provideIcons({lucideCircleCheck})
    ]
})
export class AppEventListComponent {
    private readonly calendarService = injectCalendarService();
    private readonly profiles = injectUserProfiles();
    private readonly dialogService = inject(HlmDialogService);
    protected readonly layout = inject(LayoutService)
    
    /** Emits whenever a details dialog of a calendar event has been closed */
    public readonly detailsClosed = output<EventListModel>();

    /** The events to display */
    public readonly events = input.required<CalendarEvent[]>()

    /** Whether or not the parent component is still loading events */
    public readonly loading = input(false, {transform: booleanAttribute});

    /** Whether or not only upcoming events are shown */
    public readonly onlyUpcoming = input(true, { transform: booleanAttribute })

    /** Whether or not the whole date is shown */
    public readonly showDate = input(false, { transform: booleanAttribute })

    /** Whether or not the whole date is shown */
    public readonly sort = input<'asc' | 'desc'>('asc')

    /** A list of all available calendars */
    protected readonly calendars = signal<Calendar[]>([]);

    /** The final enriched and filtered event models */
    protected readonly _computedEvents = computed(() => {
        const events = this.events();
        const calendars = this.calendars();
        const profiles = this.profiles();
        const upcoming = this.onlyUpcoming();
        const sort = this.sort();

        const result = events
            .map(event => {
                const profile = profiles.find(p => getCalendarId(p) === event.calendarId)
                const calendar = calendars.find(cal => cal.id === event.calendarId)

                return new EventListModel(event, calendar, profile)
            })
            .sort((a, b) => {
                let result = sortCalendarEvents(a, b)

                if (sort === 'desc') {
                    result = result * -1;
                }

                return result
            })
            .filter(event => {
                if (upcoming && event.isOver) {
                    return false;
                }

                return true;
            })
        
        return result
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