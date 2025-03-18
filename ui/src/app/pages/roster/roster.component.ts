import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, effect, signal } from "@angular/core";
import { Duration, Timestamp } from "@bufbuild/protobuf";
import { ConnectError } from "@connectrpc/connect";
import { lucideArrowLeft, lucideArrowRight } from "@ng-icons/lucide";
import { BrnTabsContentDirective } from "@spartan-ng/ui-tabs-brain";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { HlmCardModule } from "@tierklinik-dobersberg/angular/card";
import { injectWorktimeSerivce } from "@tierklinik-dobersberg/angular/connect";
import { HlmIconModule, provideIcons } from "@tierklinik-dobersberg/angular/icon";
import { HlmLabelDirective } from "@tierklinik-dobersberg/angular/label";
import { DurationPipe } from "@tierklinik-dobersberg/angular/pipes";
import { HlmTabsModule } from "@tierklinik-dobersberg/angular/tabs";
import { GetVacationCreditsLeftResponse } from "@tierklinik-dobersberg/apis/roster/v1";
import { addMonths, endOfYear } from "date-fns";
import { toast } from "ngx-sonner";
import { injectStoredProfile } from "src/app/utils/inject-helpers";
import { environment } from "src/environments/environment";
import { RosterCalendarComponent } from "./roster-calendar";
import { UserShiftsComponent } from "./user-shifts";

@Component({
    standalone: true,
    templateUrl: './roster.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        RosterCalendarComponent,
        UserShiftsComponent,
        HlmCardModule,
        HlmLabelDirective,
        HlmButtonDirective,
        HlmIconModule,
        DurationPipe,
        DatePipe,
        BrnTabsContentDirective,
        HlmTabsModule,
    ],
    providers: [
        ...provideIcons({lucideArrowLeft, lucideArrowRight})
    ]
})
export class RosterComponent {
    private readonly workTimeService = injectWorktimeSerivce();

    protected readonly profile = injectStoredProfile();
    protected readonly vacation = signal<Duration | null>(null)
    protected readonly overtime = signal<Duration | null>(null);
    protected readonly calendarDate = signal(new Date);

    protected readonly rosterUrl = environment.rosterService;

    constructor() {
        effect(() => {
            const user = this.profile();

            if (!user) {
                return
            }

            this.workTimeService.getVacationCreditsLeft({
                until: Timestamp.fromDate(endOfYear(new Date())),
                forUsers: {
                    userIds: [user.user.id],
                }
            })
            .catch( err => {
                toast.error('Resturlaub konnte nicht geladen werden', {
                    description: ConnectError.from(err).message
                })

                return new GetVacationCreditsLeftResponse()
            })
            .then(response => {
                const left = response.results.find(r => r.userId === user.user.id);
                if (left) {
                    this.vacation.set(left.vacationCreditsLeft)
                    this.overtime.set(left.timeOffCredits)
                } else {
                    this.vacation.set(null)
                    this.overtime.set(null);
                }
            })
        })
    }

    protected addMonths(offset: number) {
        this.calendarDate.set(
            addMonths(this.calendarDate(), offset)
        )
    }
}