import { DatePipe, NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Timestamp } from '@bufbuild/protobuf';
import { ConnectError } from '@connectrpc/connect';
import { lucideArrowLeft, lucideArrowRight, lucideCalendarDays, lucideInfo } from '@ng-icons/lucide';
import { BrnTooltipModule } from '@spartan-ng/ui-tooltip-brain';
import { injectUserProfiles } from '@tierklinik-dobersberg/angular/behaviors';
import {
  HlmCardDirective,
  HlmCardModule,
} from '@tierklinik-dobersberg/angular/card';
import { injectRosterService } from '@tierklinik-dobersberg/angular/connect';
import { TkdContainerSizeDirective } from '@tierklinik-dobersberg/angular/container';
import { HlmDialogService } from '@tierklinik-dobersberg/angular/dialog';
import { HlmIconModule, provideIcons } from '@tierklinik-dobersberg/angular/icon';
import { HlmLabelDirective } from '@tierklinik-dobersberg/angular/label';
import {
  ToUserPipe
} from '@tierklinik-dobersberg/angular/pipes';
import { HlmSkeletonComponent } from '@tierklinik-dobersberg/angular/skeleton';
import { HlmTooltipModule } from '@tierklinik-dobersberg/angular/tooltip';
import { TimeRange } from '@tierklinik-dobersberg/apis/common/v1';
import { Profile } from '@tierklinik-dobersberg/apis/idm/v1';
import { GetWorkingStaffResponse, PlannedShift } from '@tierklinik-dobersberg/apis/roster/v1';
import { differenceInDays, endOfDay, isBefore, isSameDay, startOfDay } from 'date-fns';
import { toast } from 'ngx-sonner';
import { interval } from 'rxjs';
import { AppAvatarComponent } from 'src/app/components/avatar';
import { TkdDatePickerComponent, TkdDatePickerInputDirective } from 'src/app/components/date-picker';
import { TkdDatePickerTriggerComponent } from 'src/app/components/date-picker/picker-trigger';
import { ToRGBAPipe } from 'src/app/pipes/to-rgba.pipe';
import { getCalendarId } from 'src/app/services';
import { isBetween } from 'src/app/utils/date';
import { injectStoredConfig } from 'src/app/utils/inject-helpers';
import { injectLocalPlannedShifts, LocalPlannedShift } from 'src/app/utils/shifts';

@Component({
  selector: 'app-roster-card',
  templateUrl: './roster-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    ToUserPipe,
    AppAvatarComponent,
    HlmLabelDirective,
    HlmTooltipModule,
    BrnTooltipModule,
    HlmCardModule,
    HlmIconModule,
    TkdDatePickerComponent,
    TkdDatePickerInputDirective,
    TkdDatePickerTriggerComponent,
    FormsModule,
    DatePipe,
    HlmSkeletonComponent,
    HlmTooltipModule,
    BrnTooltipModule,
    NgClass,
    ToRGBAPipe,
    TkdContainerSizeDirective
  ],
  hostDirectives: [HlmCardDirective, TkdContainerSizeDirective],
  providers: [
    ...provideIcons({lucideArrowLeft, lucideArrowRight, lucideCalendarDays, lucideInfo})
  ],
  host: {
    '[class]': 'computedClass()'
  }
})
export class RosterCardComponent {
  private readonly rosterService = injectRosterService();
  private readonly dialogService = inject(HlmDialogService);
  public readonly userHover = output<Profile | null>();

  protected readonly containerSize = inject(TkdContainerSizeDirective, {host: true})
  protected readonly currentShifts = signal<PlannedShift[]>([]);
  protected readonly profiles = injectUserProfiles();
  protected readonly config = injectStoredConfig();
  public readonly variant = input<'default' | 'small'>('default')
  protected readonly computedClass = computed(() => {
    const v= this.variant();

    if (v === 'default') {
      return '@container flex flex-col'
    }

    return '@container flex flex-col border-none'
  })


  protected readonly rosterLoading = signal(true);
  public readonly calendarDate = model<Date>(new Date);
  public readonly shiftClick = output<PlannedShift>()

  protected readonly localPlannedShifts = injectLocalPlannedShifts(this.currentShifts)

  protected readonly _computedShifts = computed<LocalPlannedShift[]>(() => {
    const current = this.localPlannedShifts();
    const calendarDate = this.calendarDate();

    return current
      .filter(shift => shift.assignedUserIds?.length > 0)
      .filter(shift => {
        if (isBefore(shift.from.toDate(), startOfDay(calendarDate))) {
          return false
        }

        return true
      })
      .sort((a, b) => {
        return Number((a.definition?.order || BigInt(0)) - (b.definition?.order || BigInt(0)))
      })
  });

  protected readonly _computedDateKind = computed<'yesterday' | 'today' | 'tomorrow' | 'other'>(() => {
    const date = startOfDay(this.calendarDate());
    const today = startOfDay(new Date());

    const diff = Math.floor(differenceInDays(date, today));

    if (diff === -1) {
      return 'yesterday'
    }

    if (diff === 0) {
      return 'today'
    }

    if (diff === 1) {
      return 'tomorrow'
    }

    return 'other'
  })

  protected openUserEvents(userId: string) {
    const profile = this.profiles().find(p => p.user.id === userId);
    if (!profile) {
      return;
    }

    if (!getCalendarId(profile)) {
      toast.error('Diesen Mitarbeiter ist kein Kalender zugewiesen')
      return;
    }

    import("../../../dialogs/event-list-dialog")
      .then(m => {
        m.EventListDialogComponent.open(this.dialogService, {
          userId: userId,
          date: this.calendarDate(),
        })
      })
  }

  constructor() {
    interval(10 * 60 * 1000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        if (!isSameDay(new Date(), this.calendarDate())) {
          this.calendarDate.set(new Date())
        }
      })

    effect(() => {
      const config = this.config();
      const date = this.calendarDate();

      this.rosterLoading.set(true)
      this.currentShifts.set([]);

      if (!date) {
        return
      }

      this.rosterService
        .getWorkingStaff2({
          query: {
            case: 'timeRange',
            value: new TimeRange({
              from: Timestamp.fromDate(startOfDay(date)),
              to: Timestamp.fromDate(endOfDay(date)),
            }),
          },
          rosterTypeName: config?.UI?.OnCallRosterType
        })
        .catch(err => {
          toast.error('Dienste konnten nicht geladen werden', {
            description: ConnectError.from(err).message,
          });

          return new GetWorkingStaffResponse();
        })
        .then(response => {
          const now = new Date();
          const filtered = (response.currentShifts || [])
            .filter(shift => {
              if (!isSameDay(date, now)) {
                return true
              }

              const start = shift.from.toDate();
              const end = shift.to.toDate();

              return isSameDay(start, now) || isBetween(now, [start, end]);
            })

          this.currentShifts.set(filtered)
          this.rosterLoading.set(false);
        });
    }, { allowSignalWrites: true });
  }
}
