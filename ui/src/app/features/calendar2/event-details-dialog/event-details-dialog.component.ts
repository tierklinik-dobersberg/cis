import { AsyncPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  HostListener,
  inject,
  model,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  MatAutocompleteModule,
  MatAutocompleteTrigger,
} from '@angular/material/autocomplete';
import { Any, Timestamp } from '@bufbuild/protobuf';
import { CKEditorModule } from '@ckeditor/ckeditor5-angular';
import { ConnectError } from '@connectrpc/connect';
import { lucideCalendar, lucideClock } from '@ng-icons/lucide';
import { BrnAlertDialogModule } from '@spartan-ng/ui-alertdialog-brain';
import {
  BrnDialogRef,
  injectBrnDialogContext,
} from '@spartan-ng/ui-dialog-brain';
import { BrnSelectModule } from '@spartan-ng/ui-select-brain';
import {
  HlmAlertDialogComponent,
  HlmAlertDialogModule,
} from '@tierklinik-dobersberg/angular/alertdialog';
import { HlmBadgeDirective } from '@tierklinik-dobersberg/angular/badge';
import {
  injectUserProfiles,
  sortProtoTimestamps,
} from '@tierklinik-dobersberg/angular/behaviors';
import { HlmButtonDirective } from '@tierklinik-dobersberg/angular/button';
import { HlmCheckboxComponent } from '@tierklinik-dobersberg/angular/checkbox';
import {
  injectCalendarService,
  injectCallService,
  injectCustomerService,
  injectTreatmentService,
} from '@tierklinik-dobersberg/angular/connect';
import {
  HlmDialogDescriptionDirective,
  HlmDialogFooterComponent,
  HlmDialogHeaderComponent,
  HlmDialogService,
  HlmDialogTitleDirective,
} from '@tierklinik-dobersberg/angular/dialog';
import {
  HlmIconModule,
  provideIcons,
} from '@tierklinik-dobersberg/angular/icon';
import { HlmInputDirective } from '@tierklinik-dobersberg/angular/input';
import { HlmLabelDirective } from '@tierklinik-dobersberg/angular/label';
import { ToDatePipe } from '@tierklinik-dobersberg/angular/pipes';
import { HlmSelectModule } from '@tierklinik-dobersberg/angular/select';
import {
  HlmTableComponent,
  HlmTdComponent,
  HlmThComponent,
  HlmTrowComponent,
} from '@tierklinik-dobersberg/angular/table';
import { Duration } from '@tierklinik-dobersberg/angular/utils/date';
import { DurationValidatorDirective } from '@tierklinik-dobersberg/angular/validators';
import {
  Calendar,
  CalendarEvent,
  CreateEventRequest,
  CustomerAnnotation,
  MoveEventRequest,
  ResourceCalendar,
  UpdateEventRequest,
} from '@tierklinik-dobersberg/apis/calendar/v1';
import {
  Customer,
  CustomerResponse,
  SearchCustomerResponse,
} from '@tierklinik-dobersberg/apis/customer/v1';
import { CallStatus } from '@tierklinik-dobersberg/apis/pbx3cx/v1';
import {
  ListTreatmentsResponse,
  Treatment,
} from '@tierklinik-dobersberg/apis/treatment/v1';
import { Markdown } from 'ckeditor5';
import { addMinutes, addSeconds } from 'date-fns';
import { MarkdownModule } from 'ngx-markdown';
import { toast } from 'ngx-sonner';
import {
  catchError,
  debounceTime,
  defer,
  filter,
  retry,
  Subject,
  switchMap,
  take,
  throwError
} from 'rxjs';
import { config, MyEditor } from 'src/app/ckeditor';
import { AppAvatarComponent } from 'src/app/components/avatar';
import { TkdDatePickerComponent } from 'src/app/components/date-picker';
import { CreateEventSheetComponent } from 'src/app/features/calendar2/create-event-sheet/create-event-sheet.component';
import { getCalendarId } from 'src/app/services';
import { AbstractBaseDialog } from '../../../dialogs/base-dialog/base-dialog.component';
import { DIALOG_CONTENT_CLASS } from '../../../dialogs/constants';
import { CreateCustomerDialog } from '../../customers/create-customer-dialog';
import { CustomerDetailsDialog } from '../../customers/customer-details-dialog';
import { getSeconds } from '../day-view/sort.pipe';

export interface EventDetailsDialogContext {
  event?: CalendarEvent;
  calendar: Calendar;
  startTime?: Date;
}

interface RecentCall {
  caller: string;
  unknown: boolean;
  name?: string;
  customer?: Customer;
}

export type DialogResultCreatedOrUpdated = CalendarEvent;
export type DialogResultDeleted = {
  type: 'deleted';
  calendarId: string;
  eventId: string;
};
export type DialogResultMoved = {
  type: 'moved';
  original: CalendarEvent;
  updated: CalendarEvent;
};

export type DialogResult =
  | DialogResultCreatedOrUpdated
  | DialogResultDeleted
  | DialogResultMoved
  | null;

@Component({
  standalone: true,
  imports: [
    HlmDialogHeaderComponent,
    HlmDialogDescriptionDirective,
    HlmDialogTitleDirective,
    HlmDialogFooterComponent,
    HlmButtonDirective,
    HlmTableComponent,
    HlmThComponent,
    HlmTrowComponent,
    HlmTdComponent,
    ToDatePipe,
    DatePipe,
    HlmIconModule,
    AppAvatarComponent,
    BrnSelectModule,
    HlmSelectModule,
    HlmBadgeDirective,
    FormsModule,
    HlmInputDirective,
    TkdDatePickerComponent,
    DurationValidatorDirective,
    BrnAlertDialogModule,
    HlmAlertDialogModule,
    CKEditorModule,
    MatAutocompleteModule,
    HlmLabelDirective,
    HlmCheckboxComponent,
    MarkdownModule,
    AsyncPipe
  ],
  providers: [...provideIcons({ lucideCalendar, lucideClock })],
  templateUrl: './event-details-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        @apply flex h-full w-full flex-col overflow-hidden;
      }
    `,
  ],
})
export class AppEventDetailsDialogComponent
  extends AbstractBaseDialog
  implements OnInit
{
  private readonly profiles = injectUserProfiles();
  private readonly calendarService = injectCalendarService();
  private readonly dialogRef = inject<BrnDialogRef<unknown>>(BrnDialogRef);
  private readonly dialogContext =
    injectBrnDialogContext<EventDetailsDialogContext>();
  private readonly dialogService = inject(HlmDialogService);

  private readonly callService = injectCallService();
  private readonly customerService = injectCustomerService();
  private readonly treatmentService = injectTreatmentService();

  protected readonly editor = MyEditor;
  protected readonly config = (() => {
    return {
      ...config,
      plugins: config.plugins.filter(p => p !== Markdown),
    };
  })();

  protected readonly recentCalls = signal<RecentCall[]>([]);

  protected event = this.dialogContext.event;
  protected readonly calendar = this.dialogContext.calendar;
  protected readonly user = computed(() => {
    const profiles = this.profiles();

    return profiles.find(p => getCalendarId(p) === this.calendar.id);
  });

  protected readonly edit = signal(false);
  protected readonly isNew = signal(false);

  protected readonly availableCalendars = signal<Calendar[]>([]);

  protected readonly calendarId = model<string>('');
  protected readonly summary = model<string>('');
  protected readonly description = model<string>('');
  protected readonly date = model<string>('');
  protected readonly startTime = model<Date>();
  protected readonly duration = model<string>('');
  protected readonly createTime = model<Date | null>(null);
  protected readonly disabledComplete = signal(false);
  protected readonly selectedCustomer = signal<Customer | null>(null);
  protected readonly availableResources = signal<ResourceCalendar[]>([]);
  protected readonly selectedResources = signal<string[]>([]);
  protected readonly customer = signal<CustomerResponse | null>(null);

  protected readonly matchingCustomers = signal<Customer[]>([]);
  protected readonly matchingTreatments = signal<Treatment[]>([]);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild(MatAutocompleteTrigger)
  autocompleteTrigger!: MatAutocompleteTrigger;

  static open(
    service: HlmDialogService,
    ctx: EventDetailsDialogContext
  ): BrnDialogRef<DialogResult> {
    return service.open(AppEventDetailsDialogComponent, {
      context: ctx,
      contentClass: DIALOG_CONTENT_CLASS,
    });
  }

  toggleResource(name: string) {
    const selected = [...this.selectedResources()];

    const idx = selected.findIndex(v => v === name);
    if (idx >= 0) {
      selected.splice(idx, 1);
    } else {
      selected.push(name);
    }

    console.log('new resources', selected);

    this.selectedResources.set(selected);
  }

  protected openCustomerDetails() {
    const c = this.customer();
    if (!c) {
      return;
    }

    CustomerDetailsDialog.open(this.dialogService, c);
  }

  @ViewChild(HlmAlertDialogComponent, { static: false })
  alertDialog: HlmAlertDialogComponent;

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    if ('key' in event && event.key === 'Delete') {
      this.alertDialog?.open();
    }
  }

  protected useNewEventSheet() {
    CreateEventSheetComponent.open(this.dialogService, {
      calendarId: this.calendarId(),
      customerId: this.customer()?.customer?.id,
      dateTime: this.startTime(),
    })

    setTimeout(() => this.close(null), 500)
  }

  ngOnInit() {
    if (this.event && !this.event.isFree) {
      this.calendarId.set(this.event.calendarId);
      this.summary.set(this.event.summary);
      this.description.set(this.event.description);
      this.startTime.set(this.event.startTime.toDate());
      this.selectedResources.set(this.event.resources || []);
      this.duration.set(
        Duration.seconds(
          getSeconds(this.event.endTime) - getSeconds(this.event.startTime)
        ).toString()
      );
      this.createTime.set(this.event.createTime?.toDate() || null);

      if (this.event.extraData) {
        let data = new CustomerAnnotation();

        if (this.event.extraData.unpackTo(data)) {
          this.customerService
            .searchCustomer({
              queries: [
                {
                  query: {
                    case: 'id',
                    value: data.customerId,
                  },
                },
              ],
            })
            .catch(err => {
              toast.error('Failed to load customer record', {
                description: ConnectError.from(err).message,
              });

              return new SearchCustomerResponse();
            })
            .then(res => {
              if (res.results && res.results.length === 1) {
                this.customer.set(res.results[0]);
              }

              console.log('got customer response', res.results);
            });
        } else {
          console.error('failed to unpack extraData', this.event.extraData);
        }
      }
    } else {
      this.duration.set('15m');
      this.edit.set(true);
      this.isNew.set(true);
      this.createTime.set(null);

      const now = new Date();
      const before = addMinutes(now, -5);

      this.callService
        .searchCallLogs({
          timeRange: {
            from: Timestamp.fromDate(before),
            to: Timestamp.fromDate(now),
          },
        })
        .then(response => {
          console.log(response.results);

          const logs = response.results
            .filter(record =>
              [
                CallStatus.INBOUND,
                CallStatus.OUTBOUND,
                CallStatus.UNSPECIFIED,
              ].includes(record.status)
            )
            .sort((a, b) => sortProtoTimestamps(b.receivedAt, a.receivedAt))
            .map(record => {
              const customer = response.customers.find(
                c => c.id === record.customerId
              );
              if (!customer) {
                return <RecentCall>{
                  caller: record.caller,
                  name: 'Neuer Kunde: ' + record.caller,
                  unknown: true,
                };
              }

              return <RecentCall>{
                caller: record.caller,
                name: `${customer.lastName} ${customer.firstName}`,
                customer: customer,
              };
            });

          const m = new Map<string, RecentCall>();
          logs.forEach(l => m.set(l.caller, l));

          const values = Array.from(m.values());
          this.recentCalls.set(values);

          if (values.length > 0) {
            this.autocompleteTrigger.openPanel();
          }
        })
        .catch(err => {
          console.error(err);
        });

      if (!this.event) {
        this.startTime.set(this.dialogContext.startTime);
        this.event = new CalendarEvent({});
        this.calendarId.set(this.calendar.id);
      } else {
        this.calendarId.set(this.event.calendarId);
        this.startTime.set(this.event.startTime.toDate());
      }
    }

    let errorMessageShown = false;
    defer(() => this.calendarService.listCalendars({}))
      .pipe(
        catchError(err => {
          if (!errorMessageShown) {
            errorMessageShown = true;
            toast.error('Kalendar konnte nicht geladen werden', {
              description: ConnectError.from(err).message,
            });
          }

          return throwError(() => err);
        }),
        retry({
          delay: 2000,
        })
      )
      .subscribe(response => {
        this.availableCalendars.set(response.calendars);
      });

    defer(() => this.calendarService.listResourceCalendars({}))
      .pipe(
        retry({
          delay: 2000,
        })
      )
      .subscribe(response => {
        this.availableResources.set(response.resourceCalendars);
      });

    this.debouncedSearch$
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        debounceTime(100),
        filter(value => value.length > 2), // only search for customers once we have at least 3 characters to search
        switchMap(searchValue => {
          const abrt = new AbortController();

          let promise: Promise<SearchCustomerResponse | ListTreatmentsResponse>;
          if (this.selectedCustomer()) {
            promise = this.treatmentService.listTreatments({
              displayNameSearch: this.summary(),
            });
          } else {
            const split = searchValue.split(' ');
            promise = this.customerService.searchCustomer(
              {
                queries: [
                  {
                    query: {
                      case: 'name',
                      value: {
                        lastName: split[0],
                        firstName: split.length > 1 ? split[1] : undefined,
                      },
                    },
                  },
                ],
              },
              { signal: abrt.signal }
            );
          }

          promise
            .catch(err => {
              toast.error('Kundendaten konnten nicht durchsucht werden', {
                description: ConnectError.from(err).message,
              });

              return new SearchCustomerResponse();
            })
            .finally(() => abrt.abort());

          return promise;
        })
      )
      .subscribe(response => {
        if (response instanceof SearchCustomerResponse) {
          this.matchingCustomers.set(
            (response.results || []).map(r => r.customer)
          );
          console.log('found customers', this.matchingCustomers());
        } else {
          this.matchingTreatments.set(response.treatments || []);
          console.log('found treatments', response.treatments);
        }
      });
  }

  protected handleCustomerSelection(call: RecentCall | Customer) {
    // this.disabledComplete.set(true);

    if (call instanceof Customer) {
      this.selectedCustomer.set(call);
      return;
    }

    if (call.unknown) {
      CreateCustomerDialog.open(this.dialogService, {
        caller: call.caller,
      })
        .closed$.pipe(take(1))
        .subscribe(customer => {
          if (!customer) {
            return;
          }

          this.selectedCustomer.set(customer);
        });
    } else {
      if (call.customer) {
        this.selectedCustomer.set(call.customer);
      }
    }

    this.matchingCustomers.set([])
  }

  private readonly debouncedSearch$ = new Subject<string>();

  protected searchCustomer(name: string) {
    if (name.length < 3) {
      this.matchingCustomers.set([]);
      this.disabledComplete.set(false);
      this.selectedCustomer.set(null);
    }

    this.debouncedSearch$.next(name);
  }

  protected customerName(c: Customer | RecentCall) {
    console.log('called with', c);
    if (!c) {
      return null;
    }

    if (c instanceof Customer) {
      return c.lastName + ' ' + c.firstName;
    }

    if (c.customer) {
      return c.customer.lastName + ' ' + c.customer.firstName;
    }

    return c.name;
  }

  protected async create() {
    var extraData: Any | undefined = undefined;

    try {
      if (this.selectedCustomer()) {
        const customer = this.selectedCustomer();

        extraData = Any.pack(
          new CustomerAnnotation({
            customerId: customer.id,
          })
        );
      }
    } catch (err) {
      console.log(err);
    }

    let summary = this.summary();
    if (typeof summary === 'object') {
      const c = summary as Customer;
      summary = c.lastName + ' ' + c.firstName;
    }

    const req = new CreateEventRequest({
      calendarId: this.calendarId(),
      description: this.description(),
      start: Timestamp.fromDate(this.startTime()),
      resources: this.selectedResources(),
      end: Timestamp.fromDate(
        addSeconds(
          this.startTime(),
          Duration.parseString(this.duration()).seconds
        )
      ),
      name: summary,
      extraData,
    });

    console.log(req);

    try {
      const result = await this.calendarService.createEvent(req);
      this.close(result.event);
    } catch (err) {
      toast.error('Termin konnte nicht erstellt werden', {
        description: ConnectError.from(err).message,
      });
    }
  }

  protected async save() {
    const req = new UpdateEventRequest({
      calendarId: this.event.calendarId,
      eventId: this.event.id,
      resources: this.selectedResources(),
      updateMask: {
        paths: ['resources'],
      },
    });

    if (this.event.description !== this.description()) {
      req.description = this.description();
      req.updateMask.paths.push('description');
    }

    if (this.event.summary !== this.summary()) {
      req.name = this.summary();
      req.updateMask.paths.push('name');
    }

    req.start = Timestamp.fromDate(this.startTime());
    req.updateMask.paths.push('start');

    const duration = Duration.parseString(this.duration()).seconds;
    req.end = Timestamp.fromDate(addSeconds(this.startTime(), duration));
    req.updateMask.paths.push('end');

    let result: DialogResult = null;

    if (req.updateMask.paths.length > 0) {
      const response = await this.calendarService
        .updateEvent(req)
        .catch(err => {
          toast.error('Termin konnte nicht gespeichert werden', {
            description: ConnectError.from(err).message,
          });

          return null;
        });

      if (response) {
        this.event = response.event;
        result = this.event;
      } else {
        return;
      }
    }

    if (this.event.calendarId !== this.calendarId()) {
      const response = await this.calendarService
        .moveEvent(
          new MoveEventRequest({
            eventId: this.event.id,
            source: {
              case: 'sourceCalendarId',
              value: this.event.calendarId,
            },
            target: {
              case: 'targetCalendarId',
              value: this.calendarId(),
            },
          })
        )
        .catch(err => {
          toast.error('Termin konnte nicht gespeichert werden', {
            description: ConnectError.from(err).message,
          });

          return null;
        });

      if (response) {
        this.event = response.event;
        result = {
          type: 'moved',
          original: this.event,
          updated: response.event,
        };
      }
    }

    if (result) {
      this.close(result);
    }

    this.edit.set(false);
  }

  protected close(event: DialogResult | null) {
    this.dialogRef.close(event);
  }

  protected async delete() {
    try {
      await this.calendarService.deleteEvent({
        calendarId: this.event.calendarId,
        eventId: this.event.id,
      });

      this.close({
        type: 'deleted',
        calendarId: this.event.calendarId,
        eventId: this.event.id,
      });
    } catch (err) {
      toast.error('Termin konnte nicht gelöscht werden', {
        description: ConnectError.from(err).message,
      });
    }
  }
}
