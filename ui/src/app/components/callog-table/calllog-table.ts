import { CdkTableModule } from '@angular/cdk/table';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  Directive,
  inject,
  input
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PartialMessage } from '@bufbuild/protobuf';
import { lucideArrowLeft, lucideArrowRight, lucidePhoneCall, lucidePhoneForwarded, lucidePhoneIncoming, lucidePhoneMissed, lucidePhoneOff, lucidePhoneOutgoing } from '@ng-icons/lucide';
import { BrnSelectModule } from '@spartan-ng/ui-select-brain';
import { BrnTableModule } from '@spartan-ng/ui-table-brain';
import { HlmBadgeDirective } from '@tierklinik-dobersberg/angular/badge';
import { injectUserProfiles, sortProtoTimestamps } from '@tierklinik-dobersberg/angular/behaviors';
import { HlmButtonDirective } from '@tierklinik-dobersberg/angular/button';
import { HlmDialogService } from '@tierklinik-dobersberg/angular/dialog';
import { TkdEmptyTableComponent } from '@tierklinik-dobersberg/angular/empty-table';
import { HlmIconModule, provideIcons } from '@tierklinik-dobersberg/angular/icon';
import { LayoutService } from '@tierklinik-dobersberg/angular/layout';
import {
  DisplayNamePipe,
  DurationPipe,
  ToDatePipe,
  ToUserPipe,
} from '@tierklinik-dobersberg/angular/pipes';
import { HlmSelectModule } from '@tierklinik-dobersberg/angular/select';
import { HlmSkeletonComponent } from '@tierklinik-dobersberg/angular/skeleton';
import { HlmTableModule } from '@tierklinik-dobersberg/angular/table';
import { Customer } from '@tierklinik-dobersberg/apis/customer/v1';
import { Profile } from '@tierklinik-dobersberg/apis/idm/v1';
import { CallDirection, CallEntry, CallStatus } from '@tierklinik-dobersberg/apis/pbx3cx/v1';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { injectCurrentConfig } from 'src/app/api';
import { KnownPhoneExtensionPipe } from 'src/app/pipes/known-phone-extension.pipe';
import { getUserEmergencyExtension, getUserPhoneExtension } from 'src/app/services';
import { usePaginationManager } from 'src/app/utils/pagination-manager';
import { TkdPaginationComponent } from '../pagination';

interface LocalCallLog {
  entry: CallEntry;

  customer?: LocalCustomer;

  outbound: boolean;
  isLostOrUnanswared: boolean;
  isSelf: boolean;

  iconName: string;
}

type LocalCustomer = PartialMessage<Customer> & {source?: string}

@Directive({
  selector: '[brnCellDef], [callLog]',
  standalone: true,
}
)
export class TemplateGuardDirective {
  static ngTemplateContextGuard(d: TemplateGuardDirective, ctx: unknown): ctx is {$implicit: LocalCallLog} {
    return true
  }
}

export enum Columns {
  Icon = "icon",
  Time = "time",
  Participants = "participants",
  Actions = "actions"
};

@Component({
  selector: 'app-calllog-table',
  templateUrl: './calllog-table.html',
  styleUrls: ['./calllog-table.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    NzToolTipModule,
    ToUserPipe,
    DisplayNamePipe,
    DurationPipe,
    HlmIconModule,
    HlmBadgeDirective,
    BrnTableModule,
    HlmTableModule,
    NgTemplateOutlet,
    TemplateGuardDirective,
    DatePipe,
    ToDatePipe,
    HlmButtonDirective,
    CdkTableModule,
    HlmSkeletonComponent,
    TkdEmptyTableComponent,
    BrnSelectModule,
    HlmSelectModule,
    HlmButtonDirective,
    FormsModule,
    TkdPaginationComponent,
    KnownPhoneExtensionPipe,
  ],
  providers: [
    ...provideIcons({
      lucidePhoneForwarded,
      lucidePhoneIncoming,
      lucidePhoneMissed,
      lucidePhoneOutgoing,
      lucidePhoneOff,
      lucideArrowRight,
      lucidePhoneCall,
      lucideArrowLeft
    })
  ]
})
export class CallLogTableComponent {
  private readonly dialogService = inject(HlmDialogService)

  /** All records */
  public readonly records = input.required<CallEntry[]>();

  /** All customers for the list of call records */
  public readonly customers = input.required<Customer[]>();

  /** Whether or not the parent component is loading data */
  public readonly loading = input(false, {transform: booleanAttribute})
  
  /** Whether successfully internal forwarded calls from the 3CX should be shown or hidden */
  public readonly hide3CXForwardedCalls = input(true);

  /** All user profiles, used to map by registered phone number */
  protected readonly profiles = injectUserProfiles();

  /** The current configuration */
  protected readonly config = injectCurrentConfig();

  /** The currently displayed columns */
  protected readonly _computedDisplayedColumns = computed(() => {
    return [
      Columns.Icon,
      Columns.Time,
      Columns.Participants,
      Columns.Actions
    ]
  })

  /** All available columns */
  protected readonly cols = Columns;

  protected readonly logs = computed<LocalCallLog[]>(() => {
    const records = this.records();
    const customers = this.customers();
    const profiles = this.profiles();

    const byId = new Map<string, Customer>();
    const byNumber = new Map<string, Customer>();
    const userByNumber = new Map<string, Profile>();

    customers.forEach(c => byId.set(c.id, c))

    profiles.forEach(p => {
      p.phoneNumbers
        .forEach(nbr => {
          userByNumber.set(normalizePhone(nbr.number), p)
        })

      const phoneExtension = getUserPhoneExtension(p)
      const emergencyExtension = getUserEmergencyExtension(p)

      if (phoneExtension) {
        userByNumber.set(normalizePhone(phoneExtension), p)
      }

      if (emergencyExtension) {
        userByNumber.set(normalizePhone(emergencyExtension), p)
      }
    })

    return records
      .map(l => {
        // TODO(ppacher): this is very specific to 3CX
        // maybe this should be configurable?
        const callType = l.callType?.toLocaleLowerCase() || 'inbound';
        let isOutbound = false;
        if (l.direction !== CallDirection.UNSPECIFIED) {
          isOutbound = l.direction == CallDirection.OUTBOUND
        } else {
          isOutbound = callType === 'notanswered' || callType === 'outbound';
        }

        let lost = false;
        if (l.status !== CallStatus.UNSPECIFIED) {
          lost = l.status == CallStatus.MISSED || l.status == CallStatus.NOTANSWERED
        } else {
          lost = callType === 'notanswered' || callType === 'missed';
        }

        if (l.queueExtension === l.acceptedAgent) {
          lost = true
        }

        let cust: LocalCustomer | null = null;

        if (l.customerId) {
          cust = byId.get(l.customerId);
        }

        if (!cust && l.caller !== 'anonymous') {
          const p = normalizePhone(l.caller)
          let userCustomer = userByNumber.get(p);

          if (userCustomer) {
            cust = {
              id: userCustomer.user.id,
              source: '__identities',
              firstName: userCustomer.user.firstName,
              lastName: userCustomer.user.lastName,
            }
          } else {
            cust = byNumber.get(p)
          }
        }

        let isSelf = false;
        if (
          !!l.agentUserId &&
          !!cust &&
          l.agentUserId === cust.id &&
          cust.source === '__identities'
        ) {
          isSelf = true;
        }

        let iconName = 'lucidePhoneIncoming'

        if (isOutbound && lost) {
            iconName = 'lucidePhoneOff'
        } else if (isOutbound) {
            iconName = 'lucidePhoneOutgoing'
        } else if (lost) {
            iconName= 'lucidePhoneMissed'
        }

        const d = l.receivedAt.toDate();
        return {
          entry: l,
          outbound: isOutbound,
          customer: cust,
          isLostOrUnanswared: lost,
          isSelf: isSelf,
          iconName,
        };
      })
      .sort((a, b) => {
        return sortProtoTimestamps(b.entry.receivedAt, a.entry.receivedAt)
      });
  });

  protected readonly _computedFilteredCalls = computed(() => {
    const logs = this.logs();
    const hideSelf = this.hide3CXForwardedCalls();

    return logs.filter(l => {
      if (hideSelf && l.isSelf && !l.isLostOrUnanswared) {
        return false
      }

      return true;
    })
  })

  public readonly paginator = usePaginationManager(this._computedFilteredCalls);

  protected readonly layout = inject(LayoutService);

  protected trackRecord(_: number, r: LocalCallLog) {
    return r.entry.id;
  }

  protected openDetails(record: LocalCallLog) {
    import("../../dialogs/call-details-dialog")
      .then(m => m.CallDetailsDialogComponent.open(
        this.dialogService,
        {
          record: record.entry,
          customer: record.customer
        }
      ))
  }
}

function normalizePhone(phone: string): string {
  return phone.replaceAll(' ', '');
}
