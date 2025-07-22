import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, Directive, effect, inject, model, signal, TrackByFunction } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Timestamp } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { lucideArrowRight, lucideTrash } from "@ng-icons/lucide";
import { BrnAlertDialogModule } from "@spartan-ng/ui-alertdialog-brain";
import { BrnTableModule } from "@spartan-ng/ui-table-brain";
import { HlmAlertDialogModule } from "@tierklinik-dobersberg/angular/alertdialog";
import { HlmBadgeDirective } from "@tierklinik-dobersberg/angular/badge";
import { injectUserProfiles, sortProtoTimestamps, sortUserProfile } from "@tierklinik-dobersberg/angular/behaviors";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { injectCallService } from "@tierklinik-dobersberg/angular/connect";
import { HlmIconModule, provideIcons } from "@tierklinik-dobersberg/angular/icon";
import { LayoutService } from "@tierklinik-dobersberg/angular/layout";
import { DisplayNamePipe, ToDatePipe } from "@tierklinik-dobersberg/angular/pipes";
import { HlmTableModule } from "@tierklinik-dobersberg/angular/table";
import { SortColumn, TkdTableSortColumnComponent } from '@tierklinik-dobersberg/angular/table-sort';
import { TimeRange } from "@tierklinik-dobersberg/apis/common/v1";
import { Profile } from "@tierklinik-dobersberg/apis/idm/v1";
import { GetOverwriteRequest, GetOverwriteResponse, InboundNumber, ListInboundNumberResponse, Overwrite } from "@tierklinik-dobersberg/apis/pbx3cx/v1";
import { isBefore } from "date-fns";
import { toast } from "ngx-sonner";
import { AppAvatarComponent } from "src/app/components/avatar";
import { TkdDatePickerComponent } from "src/app/components/date-picker";
import { EmergencyTargetService } from "src/app/features/on-call-overwrite/redirect-emergency-button/emergency-target.service";
import { HeaderTitleService } from "src/app/layout/header-title";
import { injectCurrentUserIsAdmin } from "src/app/services";

export enum Columns {
    Creator = 'creator',
    CreatedAt = 'createdAt',
    DateRange = 'dateRange',
    TransferTarget = 'transferTarget',
    Actions = 'actions',
    InboundNumber = 'inboundNumber'
}
    
export class LocalOverwrite extends Overwrite {
   public readonly isOver: boolean; 

   constructor(ov: Overwrite, public readonly creator: Profile) {
       super(ov);
       this.isOver = isBefore(this.to.toDate(), new Date())
   }
}

function getTransferTarget(target: Overwrite['target']): string {
    switch (target.case) {
        case 'custom':
            return target.value?.transferTarget
        case 'userId' :
            return target.value;
        
        default:
            throw new Error('Unsupported transfer target')
    }
}

const sortFunctions: Record<Columns, (a: LocalOverwrite, b: LocalOverwrite) => number> = {
    [Columns.Creator]: (a, b) => {
        return sortUserProfile(a.creator, b.creator)
    },
    [Columns.CreatedAt]: (a, b) => {
        return sortProtoTimestamps(a.createdAt, b.createdAt)
    },
    [Columns.DateRange]: (a, b) => {
        const res = sortProtoTimestamps(a.from, b.from);
        if (res !== 0) {
            return res;
        }
        
        return sortProtoTimestamps(a.to, b.to)
    },
    [Columns.TransferTarget]: (a, b) => {
        const at = getTransferTarget(a.target)
        const bt = getTransferTarget(b.target)

        return bt.localeCompare(at)
    },
    [Columns.InboundNumber]: (a, b) => {
        return (a.inboundNumber?.number || '').localeCompare(b.inboundNumber?.number || '')
    },
    [Columns.Actions]: () => 0
} as const;

@Directive({
    selector: '[brnCellDef]',
    standalone: true,
})
export class BrnCellDefTypeGuard {
    static ngTemplateContextGuard(dir: BrnCellDefTypeGuard, ctx: unknown): ctx is {$implicit: LocalOverwrite} {
        return true
    }
}

@Component({
    selector: 'app-overwrite-overview',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './overwrite-overview.component.html',
    imports: [
        HlmButtonDirective,
        HlmIconModule,
        HlmBadgeDirective,
        HlmTableModule,
        DisplayNamePipe,
        ToDatePipe,
        DatePipe,
        BrnTableModule,
        TkdTableSortColumnComponent,
        BrnCellDefTypeGuard,
        AppAvatarComponent,
        TkdDatePickerComponent,
        FormsModule,
        HlmAlertDialogModule,
        BrnAlertDialogModule,
    ],
    providers: [
        ...provideIcons({
            lucideTrash,
            lucideArrowRight,
        })
    ]
})
export class OverwriteOverviewComponent {
    private readonly callService = injectCallService();
    private readonly emergencyService = inject(EmergencyTargetService);
    private readonly headerService = inject(HeaderTitleService)
    
    protected readonly layout = inject(LayoutService);
    
    /** The date range for which on-call overwrites are displayed */
    protected readonly dateRange = model<[Date, Date]>([ new Date(), null ])
    
    /** All loaded Overwrite records */
    protected readonly records = signal<Overwrite[]>([]);

    protected readonly isAdmin = injectCurrentUserIsAdmin();
    
    /** All user profiles */
    protected readonly profiles = injectUserProfiles();
    
    /** Available template columns */
    protected readonly columns = Columns;
    
    /** TrackBy function for the brn-table */
    protected readonly trackRecord: TrackByFunction<LocalOverwrite> = (_, e) => e.id;
    
    /** The entry that should be deleted */
    protected readonly entryToDelete = signal<string | null>(null);

    /** A list of available inbound-numbers */
    protected readonly inboundNumbers = signal<InboundNumber[]>([]);
    
    /** The current sort direction */
    protected readonly sortDirection = model<SortColumn<typeof sortFunctions>>({
        column: Columns.DateRange,
        direction: 'DESC',
    })
    
    protected readonly _computedDisplayedColumns = computed(() => {
        const columns: Columns[] = [];
        
        columns.push(Columns.DateRange);
        columns.push(Columns.TransferTarget)
        
        if (this.layout.md()) {
            columns.push(Columns.InboundNumber)
            columns.push(Columns.Creator),
            columns.push(Columns.CreatedAt)
        }

        columns.push(Columns.Actions)
        
        return columns;
    })

    protected readonly _computedFilteredRecords = computed<LocalOverwrite[]>(() => {
        const records = this.records();
        const profiles = this.profiles();
        const numbers = this.inboundNumbers();
        
        return records
            .map(r => {
                const lo = new LocalOverwrite(r, profiles.find(p => p.user.id === r.createdByUserId));

                const n = numbers.find(n => n.number === (lo.inboundNumber?.number || ''));
                if (n) {
                    lo.inboundNumber = n;
                }

                return lo
            })
    })
    
    protected readonly _computedFilteredAndSortedRecords = computed(() => {
        const records = [...this._computedFilteredRecords()];
        const sort = this.sortDirection();
        
        if (sort) {
            const sortFn = sortFunctions[sort.column];
            records.sort((a, b) => {
                const result = sortFn(a, b)

                if (sort.direction === 'DESC') {
                    return result * -1;
                }
                
                return result;
            })
        }

        return records;
    })
    
    constructor() {
        let abrt: AbortController | null = null;

        this.callService
            .listInboundNumber({})
            .catch(err => {
                toast.error('Failed to load inbound numbers', {
                    description: ConnectError.from(err).message
                })

                return new ListInboundNumberResponse()
            })
            .then(response => this.inboundNumbers.set(response.inboundNumbers || []))

        effect(() => {
            const dateRange = this.dateRange();
            
            const req = new GetOverwriteRequest({})
            
            if (dateRange) {
                const timeRange = new TimeRange({
                    from: Timestamp.fromDate(dateRange[0]),
                    to: dateRange[1] ? Timestamp.fromDate(dateRange[1]) : undefined,
                })

                req.selector = {
                    case: 'timeRange',
                    value: timeRange,
                }
            }
            
            if (abrt !== null) {
                abrt.abort();
            }
            
            abrt = new AbortController();

            this.callService
                .getOverwrite(req, {signal: abrt.signal})
                .catch(err => {
                    const cErr = ConnectError.from(err);
                    if (cErr.code !== Code.NotFound) {
                        toast.error('Umleitungen konnten nicht geladen werden', {
                            description: cErr.message
                        })
                    }
                    
                    return new GetOverwriteResponse()
                })
                .then(response => {
                    abrt = null;
                    this.records.set(response.overwrites);
                })
        })

        this.headerService
            .set("Umleitungen")
    }
    
    protected deleteOverwrite() {
        const id = this.entryToDelete();
        if (!id) {
            return;
        }
        
        this.callService.deleteOverwrite({
            selector: {
                case: 'overwriteId',
                value: id,
            }
        })
        .then(() => {
            // reload by re-applying the date range
            toast.success('Umleitung wurde erfolgreich gelöscht')
            this.dateRange.set([...this.dateRange()])
            this.emergencyService.load();
        })
        .catch(err => {
            toast.error('Umleitung konnte nicht gelöscht werden', {
                description: ConnectError.from(err).message,
            })
        })
    }

    protected async createOverwrite() {
        const ref = await this.emergencyService.createRedirect();

        ref.closed$
            .subscribe(() => {
                this.dateRange.set([...this.dateRange()])
            })
    }
}
