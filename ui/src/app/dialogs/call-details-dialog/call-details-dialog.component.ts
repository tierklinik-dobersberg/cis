import { DatePipe, JsonPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from "@angular/core";
import { PartialMessage } from "@bufbuild/protobuf";
import { ConnectError } from "@connectrpc/connect";
import { lucidePhone, lucidePhoneCall, lucidePhoneForwarded, lucidePhoneIncoming, lucidePhoneMissed, lucidePhoneOutgoing } from "@ng-icons/lucide";
import { BrnDialogRef, injectBrnDialogContext } from "@spartan-ng/ui-dialog-brain";
import { BrnSeparatorComponent } from "@spartan-ng/ui-separator-brain";
import { BrnTabsModule } from "@spartan-ng/ui-tabs-brain";
import { HlmBadgeDirective } from "@tierklinik-dobersberg/angular/badge";
import { injectUserProfiles } from "@tierklinik-dobersberg/angular/behaviors";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { injectCallService } from "@tierklinik-dobersberg/angular/connect";
import { HlmDialogDescriptionDirective, HlmDialogFooterComponent, HlmDialogHeaderComponent, HlmDialogService, HlmDialogTitleDirective } from "@tierklinik-dobersberg/angular/dialog";
import { HlmIconModule, provideIcons } from "@tierklinik-dobersberg/angular/icon";
import { DurationPipe, ToDatePipe, ToUserPipe } from "@tierklinik-dobersberg/angular/pipes";
import { HlmSeparatorDirective } from "@tierklinik-dobersberg/angular/separator";
import { HlmTableModule } from "@tierklinik-dobersberg/angular/table";
import { HlmTabsModule } from "@tierklinik-dobersberg/angular/tabs";
import { Customer } from "@tierklinik-dobersberg/apis/customer/v1";
import { CallEntry, ListPhoneExtensionsResponse, PhoneExtension } from "@tierklinik-dobersberg/apis/pbx3cx/v1";
import { toast } from "ngx-sonner";
import { AppAvatarComponent } from "src/app/components/avatar";
import { CustomerDetailsTableComponent } from "src/app/components/customer-details-table";

export interface CallDetailsDialogContext {
    record: CallEntry,
    customer?: PartialMessage<Customer>
}

const contentClass =
      'w-screen overflow-auto max-w-[unset] sm:w-[750px] md:w-[750px] h-[100dvh] sm:h-[unset] ';

@Component({
    standalone: true,
    templateUrl: './call-details-dialog.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        HlmButtonDirective,
        HlmDialogHeaderComponent,
        HlmDialogFooterComponent,
        HlmDialogTitleDirective,
        HlmDialogDescriptionDirective,
        HlmBadgeDirective,
        BrnSeparatorComponent,
        HlmSeparatorDirective,
        HlmTabsModule,
        BrnTabsModule,
        HlmIconModule,
        HlmTableModule,
        ToDatePipe,
        DatePipe,
        DurationPipe,
        ToUserPipe,
        AppAvatarComponent,
        HlmTabsModule,
        CustomerDetailsTableComponent,
        JsonPipe,
    ],
    providers: [
        ...provideIcons({
            lucidePhone,
            lucidePhoneCall,
            lucidePhoneForwarded,
            lucidePhoneIncoming,
            lucidePhoneMissed,
            lucidePhoneOutgoing,
        })
    ]
})
export class CallDetailsDialogComponent implements OnInit {
    private readonly dialogRef = inject(BrnDialogRef);
    private readonly context = injectBrnDialogContext<CallDetailsDialogContext>()
    private readonly callService = injectCallService();

    protected readonly profiles = injectUserProfiles();
    protected readonly record = this.context.record;
    protected readonly customer = this.context.customer || null;

    protected readonly phoneExtensions = signal<PhoneExtension[]>([]);

    protected readonly _computedAgent = computed(() => {
        const ext = this.phoneExtensions();
        return ext.find(e => e.extension === this.record.acceptedAgent)
    })

    protected readonly _computedTransfer = computed(() => {
        const ext = this.phoneExtensions();
        return ext.find(e => e.extension === this.record.transferTarget)
    })

    protected readonly details = this.record.toJson();

    protected phoneIcon = (() => {
        const type = this.record.callType;

        switch (type) {
            case 'Inbound':
                return 'lucidePhoneIncoming'
            
            case 'Outbound':
                return 'lucidePhoneOutgoing'

            case 'Notanswered':
                return 'lucidePhoneOutgoing'

            case '':
                return 'lucidePhoneMissed'
        }
    })()

    static open(service: HlmDialogService, context: CallDetailsDialogContext): BrnDialogRef<CallDetailsDialogComponent> {
        return service.open(CallDetailsDialogComponent, {
            context: context,
            contentClass,
        })
    }

    protected close() {
        this.dialogRef.close();
    }

    constructor() {
        this.callService
            .listPhoneExtensions({})
            .catch(err => {
                toast.error("Telefon-Nebenstellen konnten nicht geladen werden", {
                    description: ConnectError.from(err).message
                })

                return new ListPhoneExtensionsResponse
            })
            .then(res => this.phoneExtensions.set(res.phoneExtensions || []))
    }

    ngOnInit(): void {
        
    }
}