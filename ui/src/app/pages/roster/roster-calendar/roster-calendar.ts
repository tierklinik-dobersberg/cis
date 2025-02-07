import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, effect, input, signal } from "@angular/core";
import { Timestamp } from "@bufbuild/protobuf";
import { ConnectError } from "@connectrpc/connect";
import { BrnTooltipModule } from "@spartan-ng/ui-tooltip-brain";
import { injectUserProfiles } from "@tierklinik-dobersberg/angular/behaviors";
import { injectRosterService, injectWorkShiftService } from "@tierklinik-dobersberg/angular/connect";
import { ToUserPipe, UserLetterPipe } from "@tierklinik-dobersberg/angular/pipes";
import { HlmTooltipModule } from "@tierklinik-dobersberg/angular/tooltip";
import { GetRosterResponse, ListWorkShiftsResponse, PlannedShift, WorkShift } from "@tierklinik-dobersberg/apis/roster/v1";
import { toast } from "ngx-sonner";
import { injectCurrentConfig } from "src/app/api";
import { AppAvatarComponent } from "src/app/components/avatar";
import { AppDateTableModule } from "src/app/components/date-table";
import { UserColorVarsDirective } from "src/app/components/user-color-vars";
import { WorkShiftPipe } from "src/app/pipes/workshift-name.pipe";
import { ShiftsPipe } from "./shifts.pipe";

@Component({
    selector: 'app-roster-calendar',
    standalone: true,
    templateUrl: './roster-calendar.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        AppDateTableModule,
        ShiftsPipe,
        WorkShiftPipe,
        ToUserPipe,
        UserColorVarsDirective,
        UserLetterPipe,
        HlmTooltipModule,
        AppAvatarComponent,
        BrnTooltipModule,
        DatePipe,
    ]
})
export class RosterCalendarComponent {
    private readonly rosterService = injectRosterService();
    private readonly workShiftService = injectWorkShiftService();

    public readonly config = injectCurrentConfig();
    public readonly calendarDate = input.required<Date>();
    
    protected readonly profiles = injectUserProfiles();
    protected readonly shifts = signal<PlannedShift[]>([]);
    protected readonly definitions = signal<WorkShift[]>([]);

    constructor() {
        this.workShiftService
            .listWorkShifts({})
            .catch(err => {
                toast.error('Dienste konnte nicht geladen werden', {
                    description: ConnectError.from(err).message,
                })

                return new ListWorkShiftsResponse();
            })
            .then(response => this.definitions.set(response.workShifts))

        effect(() => {
            const config = this.config();
            const date = this.calendarDate();

            if (!date || !config || !config.UI?.OnCallRosterType) {
                return
            }

            this.rosterService.getRoster({
                rosterTypeNames: [config.UI?.OnCallRosterType],
                search: {
                    case: 'date',
                    value: Timestamp.fromDate(date),
                },
                readMask: {
                    paths: ['roster']
                }
            })
            .catch( err => {
                toast.error('Dienstplan konnte nicht geladen werden', {
                    description: ConnectError.from(err).message
                })

                return new GetRosterResponse()
            })
            .then(response => {
                if (!response.roster?.length) {
                    return
                }

                this.shifts.set(response.roster[0].shifts)
            })
        })
    }
}