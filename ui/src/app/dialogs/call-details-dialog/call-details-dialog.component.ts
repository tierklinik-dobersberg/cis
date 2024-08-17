import { DatePipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from "@angular/core";
import { PartialMessage } from "@bufbuild/protobuf";
import { lucidePhone, lucidePhoneCall, lucidePhoneForwarded, lucidePhoneIncoming, lucidePhoneMissed, lucidePhoneOutgoing } from "@ng-icons/lucide";
import { BrnDialogRef, injectBrnDialogContext } from "@spartan-ng/ui-dialog-brain";
import { BrnSeparatorComponent } from "@spartan-ng/ui-separator-brain";
import { BrnTabsModule } from "@spartan-ng/ui-tabs-brain";
import { HlmBadgeDirective } from "@tierklinik-dobersberg/angular/badge";
import { injectUserProfiles } from "@tierklinik-dobersberg/angular/behaviors";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { HlmDialogDescriptionDirective, HlmDialogFooterComponent, HlmDialogHeaderComponent, HlmDialogService, HlmDialogTitleDirective } from "@tierklinik-dobersberg/angular/dialog";
import { HlmIconModule, provideIcons } from "@tierklinik-dobersberg/angular/icon";
import { DurationPipe, ToDatePipe, ToUserPipe } from "@tierklinik-dobersberg/angular/pipes";
import { HlmSeparatorDirective } from "@tierklinik-dobersberg/angular/separator";
import { HlmTableModule } from "@tierklinik-dobersberg/angular/table";
import { HlmTabsModule } from "@tierklinik-dobersberg/angular/tabs";
import { CallEntry } from "@tierklinik-dobersberg/apis";
import { Customer } from "@tierklinik-dobersberg/apis/gen/es/tkd/customer/v1/customer_pb";
import { injectCurrentConfig } from "src/app/api";
import { AppAvatarComponent } from "src/app/components/avatar";

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
        AppAvatarComponent
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

    protected readonly profiles = injectUserProfiles();
    protected readonly record = this.context.record;
    protected readonly customer = this.context.customer || null;

    protected readonly config = injectCurrentConfig();

    protected readonly _computedAgent = computed(() => {
        const config = this.config();

        return (config.KnownPhoneExtension || [])
            .find(e => e.ExtensionNumber === this.record.acceptedAgent);
    })

    protected readonly _computedTransfer = computed(() => {
        const config = this.config();

        return (config.KnownPhoneExtension || [])
            .find(e => e.ExtensionNumber === this.record.transferTarget);
    })

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

    ngOnInit(): void {
        
    }
}