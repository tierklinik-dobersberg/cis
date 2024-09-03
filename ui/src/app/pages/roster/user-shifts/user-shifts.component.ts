import { DatePipe, NgClass } from "@angular/common";
import { ChangeDetectionStrategy, Component, effect, input, signal } from "@angular/core";
import { Timestamp } from "@bufbuild/protobuf";
import { ConnectError } from "@connectrpc/connect";
import { HlmBadgeDirective } from "@tierklinik-dobersberg/angular/badge";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { injectRosterService } from "@tierklinik-dobersberg/angular/connect";
import { IsSameDayPipe, ToDatePipe } from "@tierklinik-dobersberg/angular/pipes";
import { HlmTableModule } from "@tierklinik-dobersberg/angular/table";
import { GetUserShiftsResponse, PlannedShift, WorkShift } from "@tierklinik-dobersberg/apis/roster/v1";
import { endOfMonth, startOfMonth } from "date-fns";
import { toast } from "ngx-sonner";
import { WorkShiftPipe } from "src/app/pipes/workshift-name.pipe";

@Component({
    selector: 'app-user-shifts',
    standalone: true,
    templateUrl: './user-shifts.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        HlmTableModule,
        WorkShiftPipe,
        HlmBadgeDirective,
        HlmButtonDirective,
        ToDatePipe,
        DatePipe,
        IsSameDayPipe,
        NgClass
    ],
})
export class UserShiftsComponent {
    private readonly rosterService = injectRosterService();

    public readonly calendarDate = input.required<Date>();

    protected readonly userShifts = signal<PlannedShift[]>([]);
    protected readonly definitions = signal<WorkShift[]>([]);
    protected readonly today = signal(new Date());

    constructor() {
        let abrt: AbortController | null = null;
        effect(() => {
            if (abrt) {
                abrt.abort();
            }

            abrt = new AbortController();

            const now = this.calendarDate();
            this.rosterService.getUserShifts({
                timerange: {
                    from: Timestamp.fromDate(startOfMonth(now)),
                    to: Timestamp.fromDate(endOfMonth(now)),
                }
            }, { signal: abrt.signal })
            .catch(err => {
                toast.error('Dienste konnte nicht geladen werden', {
                    description: ConnectError.from(err).message
                })

                return new GetUserShiftsResponse()
            })
            .then(response => {
                this.userShifts.set(response.shifts || [])
                this.definitions.set(response.definitions || []);
            })
        })
    }
}