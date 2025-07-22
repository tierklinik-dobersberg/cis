import { DatePipe, NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, effect, inject, model, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Timestamp } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { BrnDialogRef, injectBrnDialogContext } from "@spartan-ng/ui-dialog-brain";
import { BrnSelectModule } from "@spartan-ng/ui-select-brain";
import { BrnSeparatorComponent } from "@spartan-ng/ui-separator-brain";
import { BrnSheetModule } from "@spartan-ng/ui-sheet-brain";
import { injectUserProfiles } from "@tierklinik-dobersberg/angular/behaviors";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { injectCallService, injectRosterService } from "@tierklinik-dobersberg/angular/connect";
import { HlmDialogModule } from "@tierklinik-dobersberg/angular/dialog";
import { HlmInputDirective } from "@tierklinik-dobersberg/angular/input";
import { HlmLabelDirective } from "@tierklinik-dobersberg/angular/label";
import { ToDatePipe } from "@tierklinik-dobersberg/angular/pipes";
import { HlmSelectModule } from "@tierklinik-dobersberg/angular/select";
import { HlmSeparatorDirective } from "@tierklinik-dobersberg/angular/separator";
import { HlmSheetModule } from "@tierklinik-dobersberg/angular/sheet";
import { TimeRange } from "@tierklinik-dobersberg/apis/common/v1";
import { Profile } from "@tierklinik-dobersberg/apis/idm/v1";
import { CreateOverwriteRequest, CustomOverwrite, InboundNumber, ListInboundNumberResponse, ListPhoneExtensionsResponse, PhoneExtension } from "@tierklinik-dobersberg/apis/pbx3cx/v1";
import { GetWorkingStaffResponse, PlannedShift } from "@tierklinik-dobersberg/apis/roster/v1";
import { endOfDay, isSameDay, startOfDay } from "date-fns";
import { toast } from "ngx-sonner";
import { AppAvatarComponent } from "src/app/components/avatar";
import { TkdDatePickerComponent } from "src/app/components/date-picker";
import { EmergencyTargetService } from "src/app/features/on-call-overwrite/emergency-target.service";
import { injectStoredConfig } from "src/app/utils/inject-helpers";
import { injectLocalPlannedShifts } from "src/app/utils/shifts";
import { AbstractBaseDialog } from "../../../dialogs/base-dialog/base-dialog.component";
import { SelectionSheet, SelectionSheetItemDirective } from "../../../dialogs/selection-sheet";
import { SheetItemGroupDirective } from "../../../dialogs/selection-sheet/selection-group.directive";

export interface CreateOverwriteContext {
    inboundNumber?: string;
}

@Component({
    selector: 'app-overwrite-create',
    standalone: true,
    templateUrl: './create-overwrite.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        'class': 'overflow-auto'
    },
    imports: [
        HlmButtonDirective,
        HlmInputDirective,
        AppAvatarComponent,
        HlmSelectModule,
        BrnSelectModule,
        TkdDatePickerComponent,
        FormsModule,
        HlmDialogModule,
        BrnSeparatorComponent,
        HlmSeparatorDirective,
        HlmLabelDirective,
        BrnSheetModule,
        HlmSheetModule,
        ToDatePipe,
        DatePipe,
        SelectionSheet,
        SelectionSheetItemDirective,
        NgTemplateOutlet,
        SheetItemGroupDirective,
    ]
})
export class CreateOverwriteComponent extends AbstractBaseDialog {
    private readonly dialogRef = inject(BrnDialogRef);
    private readonly callService = injectCallService();
    private readonly rosterService = injectRosterService();
    private readonly emergencyTargetService = inject(EmergencyTargetService);
    private readonly config = injectStoredConfig();

    protected displayProfileGroup =  (item: Profile | PhoneExtension, prev?: Profile | PhoneExtension) => !prev;
    protected displaySettingsGroup = (item: Profile | PhoneExtension, prev?: Profile | PhoneExtension) => prev instanceof Profile && !(item instanceof Profile);

    protected readonly context = injectBrnDialogContext<CreateOverwriteContext>();

    protected readonly profiles = injectUserProfiles();

    protected readonly _computedValidProfiles = computed(() => {
        const profiles = this.profiles()

        return profiles.filter(p => {
            if (p.user?.deleted) {
                return false
            }

            if (p.phoneNumbers?.length > 0) {
                return true
            }

            if (p.user.extra) {
                const phoneExtension = p.user.extra.fields['phoneExtension'];
                if (phoneExtension && phoneExtension.kind.case === 'stringValue' && phoneExtension.kind.value) {
                    return true
                }

                const emergencyExtension = p.user.extra.fields['emergencyExtension'];
                if (emergencyExtension && emergencyExtension.kind.case === 'stringValue' && emergencyExtension.kind.value) {
                    return true
                }
            }

            return false
        })
    })

    protected readonly _computedTargetItems = computed(() => {
        const profiles = this._computedValidProfiles();
        const settings = this.quickSettings();

        return [
            ...profiles,
            ...settings,
        ]
    })

    protected readonly shifts = signal<PlannedShift[]>([])
    protected readonly localPlannedShifts = injectLocalPlannedShifts(this.shifts);
    protected readonly inboundNumbers = signal<InboundNumber[]>([]);

    protected readonly dateRange = model<[Date, Date] | null>(null)
    protected readonly selectedProfile = model<Profile | PhoneExtension | null>(null);
    protected readonly customTarget = model<string>('');
    protected readonly shiftDate = model<Date>(new Date());
    protected readonly quickSettings = model<PhoneExtension[]>([]);
    protected readonly numberToRedirect = model<InboundNumber | null>(null);

    protected close() {
        this.dialogRef.close();
    }

    protected create() {
        const [from, to] = this.dateRange();
        const number = this.numberToRedirect();
        const req = new CreateOverwriteRequest({
            from: Timestamp.fromDate(from),
            to: Timestamp.fromDate(to),
            inboundNumber: number ? number.number : ''
        })

        const profile = this.selectedProfile();
        let custom = this.customTarget();

        if (custom) {
            req.transferTarget = {
                case: 'custom',
                value: new CustomOverwrite({
                    displayName: custom,
                    transferTarget: custom,
                })
            }
        } else if (!(profile instanceof Profile)) {
            req.transferTarget = {
                case: 'custom',
                value: new CustomOverwrite({
                    displayName: profile.displayName,
                    transferTarget: profile.extension,
                })
            }
        } else {
            req.transferTarget = {
                case: 'userId',
                value: profile.user.id
            }
        }

        this.callService
            .createOverwrite(req)
            .then(() => {
                this.emergencyTargetService.load();
                this.dialogRef.close();
            })
            .catch(err => {
                toast.error('Umleitung konnte nicht erstellt werden', {
                    description: ConnectError.from(err).message
                })
            })
    }

    constructor() {
        super()

        this.callService
            .listInboundNumber({})
            .catch(err => {
                toast.error('Failed to load inbound-numbers', {
                    description: ConnectError.from(err).message
                })

                return new ListInboundNumberResponse();
            })
            .then(response => {
                this.inboundNumbers.set(response.inboundNumbers || [])

                if (this.context.inboundNumber) {
                    this.numberToRedirect.set(response.inboundNumbers.find(n => n.number === this.context.inboundNumber))
                } else 
                if (response.inboundNumbers.length > 0) {
                    this.numberToRedirect.set(response.inboundNumbers[0]);
                }
            });

        this.callService
            .listPhoneExtensions({})
            .catch(err => {
                toast.error('Bekannte Telefon-Nebenstellen konnten nicht geladen werden', {
                    description: ConnectError.from(err).message
                })

                return new ListPhoneExtensionsResponse()
            })
            .then(res => {
                this.quickSettings.set(
                    (res.phoneExtensions || []).filter(e => e.eligibleForOverwrite)
                )
            })

        effect(() => {
            const config = this.config();
            const date = this.shiftDate();
            const numberToRedirect = this.numberToRedirect();

            if (!config || !config.UI?.OnCallRosterType)  {
                return;
            }

            this.shifts.set([])

            const now = new Date();
            let from = startOfDay(date);

            if (isSameDay(date, now)) {
                // there's no need to redirect work-shifts from
                // the past.
                from = now;
            }

            this.rosterService
                .getWorkingStaff2({
                    rosterTypeName: config.UI.OnCallRosterType,
                    query: {
                        case: 'timeRange',
                        value: new TimeRange({
                            from: Timestamp.fromDate(from),
                            to: Timestamp.fromDate(endOfDay(date))
                        })
                    },
                    shiftTags: numberToRedirect ? numberToRedirect.rosterShiftTags : undefined
                })
                .catch(err => {
                    const cErr = ConnectError.from(err);
                    if (cErr.code !== Code.NotFound) {
                        toast.error('Arbeitsschichten konnten nicht geladen werden', {
                            description: cErr.message
                        })
                    }

                    return new GetWorkingStaffResponse()
                })
                .then(response => {
                    this.shifts.set(response.currentShifts) 

                    let range = 
                    response.currentShifts
                        .reduce((prev, cur) => {
                            let [min, max] = prev;

                            if (cur.from.toDate().getTime() < min) {
                                min = cur.from.toDate().getTime();
                            }

                            if (cur.to.toDate().getTime() > max) {
                                max = cur.to.toDate().getTime();
                            }

                            return [min, max]
                        }, [Infinity, -Infinity])

                    const [min, max] = range;

                    if (min !== Infinity && max !== -Infinity) {
                        this.dateRange.set([
                            new Date(min),
                            new Date(max),
                        ])
                    }
                })
        }, { allowSignalWrites: true })

        effect(() => {
            const selectedUser = this.selectedProfile();

            if (selectedUser) {
                this.customTarget.set('')
            }
        }, { allowSignalWrites: true })

        effect(() => {
            const customTarget = this.customTarget();

            if (customTarget) {
                this.selectedProfile.set(null)
            }
        }, { allowSignalWrites: true })
    }
}
