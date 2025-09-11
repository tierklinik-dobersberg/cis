import { AsyncPipe, DatePipe, NgClass } from "@angular/common";
import { Component, computed, effect, inject, signal } from "@angular/core";
import { Duration } from "@bufbuild/protobuf";
import { ConnectError } from "@connectrpc/connect";
import { provideIcons } from "@ng-icons/core";
import { lucideCircleMinus, lucideCirclePlus } from "@ng-icons/lucide";
import { HlmBadgeDirective } from "@tierklinik-dobersberg/angular/badge";
import { sortProtoTimestamps } from "@tierklinik-dobersberg/angular/behaviors";
import { injectOfftimeService, injectRosterService } from "@tierklinik-dobersberg/angular/connect";
import { HlmDialogService } from "@tierklinik-dobersberg/angular/dialog";
import { HlmIconComponent } from "@tierklinik-dobersberg/angular/icon";
import { LayoutService } from "@tierklinik-dobersberg/angular/layout";
import { DurationPipe, ToDatePipe } from "@tierklinik-dobersberg/angular/pipes";
import { HlmTableComponent, HlmTableModule } from "@tierklinik-dobersberg/angular/table";
import { GetRosterResponse, OffTimeCosts, Roster, UserOffTimeCosts } from "@tierklinik-dobersberg/apis/roster/v1";
import { MarkdownModule } from "ngx-markdown";
import { toast } from "ngx-sonner";
import { AppAvatarComponent } from "src/app/components/avatar";
import { injectStoredProfile } from "src/app/utils/inject-helpers";
import { RosterDialogComponent } from "../../roster/roster-dialog/roster-dialog.component";

class CostEntryModel extends OffTimeCosts {
    public readonly iconName: string;
    public readonly iconClass: string;

    public roster: Roster | undefined;
    public expected: Duration | undefined;
    public planned: Duration | undefined;

    constructor(costs: OffTimeCosts) {
        super(costs)

        if (costs.costs?.seconds > 0) {
            this.iconName = 'lucideCirclePlus'
            this.iconClass = 'text-green-500'
        } else {
            this.iconName = 'lucideCircleMinus'
            this.iconClass = 'text-red-500'
        }
    }
}

@Component({
    selector: 'offtime-entry-history',
    standalone: true,
    templateUrl: './offtime-entry-history.component.html',
    imports: [
    HlmTableComponent,
    HlmBadgeDirective,
    ToDatePipe,
    DatePipe,
    HlmTableModule,
    DurationPipe,
    AppAvatarComponent,
    HlmIconComponent,
    MarkdownModule,
    AsyncPipe,
    NgClass
],
providers: [
    ...provideIcons({
        lucideCirclePlus,
        lucideCircleMinus,
    })
]
})
export class OfftimeEntryHistoryComponent {
    private readonly offtimeService = injectOfftimeService();
    private readonly rosterService = injectRosterService();
    private readonly profile = injectStoredProfile();
    private readonly rosters = signal<Map<string, GetRosterResponse>>(new Map);
    private readonly dialogService = inject(HlmDialogService)

    protected readonly layout = inject(LayoutService)

    private costs = signal<CostEntryModel[]>([]);

    protected data = computed(() => {
        const all = [...(this.costs())];
        const rosters = this.rosters();

        // sort them by their actual date and not by createdAt as returned from the API.
        return all
            .map(c => {
                if (c.rosterId) {
                    const r = rosters.get(c.rosterId);
                    c.roster = r.roster[0] || undefined;

                    if (r.workTimeAnalysis[0]) {
                        c.expected = r.workTimeAnalysis[0].expectedTime;
                        c.planned = r.workTimeAnalysis[0].plannedTime;
                    }
                }

                return c;
            })
            .sort((a, b) => -sortProtoTimestamps(a.date, b.date))
    })

    protected openRoster(roster: Roster) {
        RosterDialogComponent.open(this.dialogService, {
            date: roster.from,
        })
    }

    constructor() {
        // Effect to load all offtime costs as soon as the user profile is ready
        effect(() => {
            const id = this.profile().user?.id;
            if (!id) {
                return
            }

            this.offtimeService
                .getOffTimeCosts({
                    forUsers: {
                        userIds: [id],
                    },
                })
                .then(response => {
                    const results = response.results[0] || new UserOffTimeCosts;
                    this.costs.set(
                        results.costs?.map(c => new CostEntryModel(c))
                    )
                })
                .catch(err => {
                    toast.error('ZA Einträge konnten nicht geladen werden', {
                        description: ConnectError.from(err).message
                    })
                })
        })

        // Effect to load all distinct rosters and off-time entries once we know which ones we need
        effect(() => {
            const costs = this.costs();
            const rosterIds = new Set<string>();
            const offtimeIds = new Set<string>();
            const profile = this.profile();

            if (!profile) {
                return
            }

            costs?.forEach(c => {
                if (c.offtimeId) {
                    offtimeIds.add(c.offtimeId)
                }

                if (c.rosterId) {
                    rosterIds.add(c.rosterId)
                }
            })

            Promise.all(
                Array.from(rosterIds.values())
                    .map(id => this.rosterService.getRoster({
                        search: {
                            case: 'id',
                            value: id
                        },
                        readMask: {
                            paths: ['roster', 'work_time_analysis']
                        } 
                    }))
            )
            .then(rosters => {
                const userId = profile.user!.id;

                const m = new Map<string, GetRosterResponse>();
                rosters.forEach(r => {
                    if (!r.roster[0]) {
                        return
                    }

                    r.workTimeAnalysis = r.workTimeAnalysis.filter(wta => wta.userId === userId)
                    console.log(r)
                    m.set(r.roster[0].id, r)
                })

                this.rosters.set(m)
            })
            .catch(err => {
                toast.error('Dienstpläne konnten nicht geladen werden', {
                    description: ConnectError.from(err).message
                })
            })
        })
    }
}