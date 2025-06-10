import { animate, style, transition, trigger } from '@angular/animations';
import { GlobalPositionStrategy } from '@angular/cdk/overlay';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  model,
  OnInit,
  QueryList,
  signal,
  untracked,
  ViewChildren
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Any, PartialMessage, Timestamp } from '@bufbuild/protobuf';
import { CKEditorModule } from '@ckeditor/ckeditor5-angular';
import { ConnectError } from '@connectrpc/connect';
import {
  lucideChevronDown,
  lucideSearch,
  lucideUserRound,
  lucideUserRoundCheck,
  lucideUserRoundSearch
} from '@ng-icons/lucide';
import { hlm } from '@spartan-ng/ui-core';
import { BrnDialogRef, injectBrnDialogContext } from '@spartan-ng/ui-dialog-brain';
import { BrnSelectModule } from '@spartan-ng/ui-select-brain';
import { BrnTooltipContentDirective } from '@spartan-ng/ui-tooltip-brain';
import { HlmAccordionModule } from '@tierklinik-dobersberg/angular/accordion';
import { sortProtoTimestamps } from '@tierklinik-dobersberg/angular/behaviors';
import { HlmButtonDirective } from '@tierklinik-dobersberg/angular/button';
import {
  injectCalendarService,
  injectCallService,
  injectCustomerService,
  PATIENT_SERVICE,
} from '@tierklinik-dobersberg/angular/connect';
import { HlmDialogService } from '@tierklinik-dobersberg/angular/dialog';
import {
  HlmIconComponent,
  provideIcons,
} from '@tierklinik-dobersberg/angular/icon';
import { HlmInputDirective } from '@tierklinik-dobersberg/angular/input';
import { HlmLabelDirective } from '@tierklinik-dobersberg/angular/label';
import { HlmSelectModule } from '@tierklinik-dobersberg/angular/select';
import { HlmSheetModule } from '@tierklinik-dobersberg/angular/sheet';
import { HlmTooltipModule } from '@tierklinik-dobersberg/angular/tooltip';
import { Calendar, CreateEventRequest, CustomerAnnotation } from '@tierklinik-dobersberg/apis/calendar/v1';
import {
  Customer,
  CustomerQuery,
  GetPatientsByCustomerResponse,
  Patient,
  SearchCustomerResponse,
} from '@tierklinik-dobersberg/apis/customer/v1';
import { CallStatus } from '@tierklinik-dobersberg/apis/pbx3cx/v1';
import { Species } from '@tierklinik-dobersberg/apis/treatment/v1';
import { Markdown } from 'ckeditor5';
import { addMinutes, addSeconds } from 'date-fns';
import { MarkdownModule } from 'ngx-markdown';
import { toast } from 'ngx-sonner';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  finalize,
  from,
  of,
  Subject,
  switchMap,
} from 'rxjs';
import { config, MyEditor } from 'src/app/ckeditor';
import { AppIconComponent } from 'src/app/components/app-icon/app-icon.component';
import { TkdDatePickerComponent } from 'src/app/components/date-picker';
import { Duration } from 'src/utils/duration';
import { PatientIconPipe } from '../patient-icon.pipe';

const contentClass =
  'foobar flex w-screen sm:w-screen md:w-screen !max-w-[unset] flex-col gap-0 overflow-auto rounded-l-3xl p-0 lg:w-[70vw] lg:!max-w-[1200px] h-screen !h-[100dvh]';
const noAnimation =
  'data-[state=closed]:animate-out data-[state=closed]:fade-out-[unset] data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right data-[state=closed]:slide-out-to-top-0 data-[state=closed]:zoom-out-[unset] data-[state=open]:animate-in data-[state=open]:fade-in-[unset] data-[state=open]:slide-in-from-top-0 data-[state=open]:zoom-in-[unset] data-[state=closed]:duration-300 data-[state=open]:duration-500';

class CustomerModel extends Customer {
  public readonly isUnknow: boolean;

  constructor(cust: PartialMessage<Customer> | string) {
    if (typeof cust === 'object') {
      super(cust);
    } else {
      super({
        id: cust,
        lastName: cust,
        addresses: [
          {
            city: 'Neuer Kunde',
          },
        ],
      });

      this.isUnknow = true;
    }
  }
}

class PatientWithSpecies extends Patient {
  constructor(p: PartialMessage<Patient>, public readonly assignedSpecies?: Species) {
    super(p)
  }
}

class PatientModel extends PatientWithSpecies {
  public description = signal('');

  constructor(p: PartialMessage<Patient>, public readonly assignedSpecies?: Species) {
    super(p, assignedSpecies);
  }
}



export type CreateEventContext = {
  calendarId: string;
  dateTime: Date
} | {
  customerId: string
  isUnknown: boolean
}

@Component({
  selector: 'create-event-sheet',
  standalone: true,
  templateUrl: './create-event-sheet.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HlmSheetModule,
    HlmAccordionModule,
    HlmIconComponent,
    HlmLabelDirective,
    HlmButtonDirective,
    FormsModule,
    HlmInputDirective,
    PatientIconPipe,
    MarkdownModule,
    HlmTooltipModule,
    BrnTooltipContentDirective,
    CKEditorModule,
    TkdDatePickerComponent,
    HlmSelectModule,
    BrnSelectModule,
    AppIconComponent,
  ],
  viewProviders: [
    ...provideIcons({
      lucideSearch,
      lucideChevronDown,
      lucideUserRoundSearch,
      lucideUserRoundCheck,
      lucideUserRound,
    }),
  ],
  host: {
    'class': 'w-full flex flex-col min-h-full'
  },
  animations: [
    trigger('slide', [
      transition(':enter', [
        style({transform: 'translateY(-100%)'}),
        animate('150ms ease-in', style({transform: 'translateY(0%)'}))
      ]),
      transition(':leave', [
        animate('150ms ease-in', style({transform: 'translateY(-100%)'}))
      ])
    ])
  ]
})
export class CreateEventSheetComponent implements OnInit, AfterViewInit {
  /** Static method to open the create event-sheet component */
  static open(dialog: HlmDialogService, ctx?: CreateEventContext): BrnDialogRef<unknown> {
    const ref = dialog.open(CreateEventSheetComponent, {
      context: ctx,
      contentClass: hlm(contentClass, noAnimation),
      positionStrategy: new GlobalPositionStrategy().top('0px').right('0px'),
    });

    return ref;
  }

  private readonly callService = injectCallService();
  private readonly customerService = injectCustomerService();
  private readonly patientService = inject(PATIENT_SERVICE);
  private readonly calendarService = injectCalendarService()
  private readonly iconPipe = new PatientIconPipe();
  private readonly context: CreateEventContext | undefined = injectBrnDialogContext();
  private readonly ref = inject(BrnDialogRef)

  protected readonly calendars = signal<Calendar[]>([])
  protected focusedIndex = signal(0);

  protected close() {
    this.ref.close()
  }

  protected handleSearchKeydown(event: KeyboardEvent) {
    let idx = this.focusedIndex();

    let max = !!this.selectedCustomer()
      ? this.patients().length
      : this.customers().length;

    switch (event.key) {
      case 'ArrowLeft':
        idx--
        break

      case 'ArrowRight':
        idx++
        break;

      case 'Enter':
        if (!this.selectedCustomer()) {
          const customer = this.customers()[this.focusedIndex()]
          if (!customer) {
            return
          }

          this.selectedCustomer.set(customer);
        } else {
          const p = this.patients()[this.focusedIndex()]
          if (!p) {
            return
          }

          this.togglePatient(p)
        }
        return

      default:
        return
    }


    if (!event.shiftKey) {
      if (idx < 0) {
        idx = max - 1;
      } else if (idx >= max) {
        idx = 0
      }

      this.focusedIndex.set(idx)


      event.preventDefault()
    }
  }

  protected readonly editor = MyEditor;
  protected readonly config = (() => {
    return {
      ...config,
      plugins: config.plugins.filter(p => p !== Markdown),
    };
  })();

  protected readonly patientsVisible = signal(true);
  protected readonly dateTime = signal<Date | null>(null)
  protected readonly duration = signal('15m');
  protected readonly description = model('');
  protected readonly computedSummary = computed(() => {
    const selected = this.selectedPatients();
    let freeText = this.freeSummaryText();

    let t = selected
      .map(p => {
        let n = p.patientName;
        if (n === 'Unbekannt') {
          n = p.species || p.breed
        }

        let d = p.description();
        if (d !== '' && n !== '') {
          d = ': ' + d
        }

        return `${this.iconPipe.transform(p)} ${n}${d}`
      })
      .join(', ') 

      if (freeText === '') {
        return t
      }

      if (t === '') {
        return freeText
      }

      return t + ' | ' + freeText
  })

  protected readonly freeSummaryText = signal('');

  /** All recent calls mapped to local customer models */
  protected readonly recentCalls = signal<CustomerModel[]>([]);

  /** All matching customers when searched by text */
  protected readonly matchingCustomers = signal<CustomerModel[]>([]);

  /** The current search text for customers */
  protected readonly customerSearchText = model('');

  /** The selected customer */
  protected readonly selectedCustomer = model<CustomerModel | null>(null);

  /** The selected calendar */
  protected readonly selectedCalendarId = model<string | null>(null)

  /** All known patients of the customer */
  protected readonly customerPatients = model<PatientWithSpecies[]>([]);

  /** All selected patients */
  protected readonly selectedPatients = signal<PatientModel[]>([]);

  protected togglePatient(p: PatientWithSpecies) {
    const all = [...this.selectedPatients()];
    const indx = all.findIndex(s => s.patientId === p.patientId);

    if (indx < 0) {
      all.push(new PatientModel(p, p.assignedSpecies));
      this.patientSearchText.set('')
    } else {
      all.splice(indx, 1);
    }

    this.selectedPatients.set(all);
  }

  /** Matching patients to display */
  protected readonly patients = computed(() => {
    const text = this.patientSearchText();
    const selected = this.selectedPatients();

    const all = this.customerPatients().filter(p => {
      return !selected.some(s => s.patientId === p.patientId);
    });

    if (text === '') {
      return all;
    }

    return all.filter(val =>
      val.patientName.toLocaleLowerCase().startsWith(text.toLocaleLowerCase())
    );
  });

  /** The current search text for customers */
  protected readonly patientSearchText = model('');

  protected readonly searchinProgress = signal(false);

  protected readonly customers = computed(() => {
    const text = this.customerSearchText();
    const calls = this.recentCalls();
    const matchingCustomers = this.matchingCustomers();

    if (this.searchinProgress()) {
      return [];
    }

    if (text === '') {
      return calls;
    }

    if (matchingCustomers.length === 0) {
      return [new CustomerModel(text)];
    }

    return matchingCustomers;
  });

  private debounced$ = new Subject<string>();
  private destroyRef = inject(DestroyRef);

  @ViewChildren('patientDescription', { read: ElementRef })
  patientDescriptionInputs!: QueryList<ElementRef>;

  @ViewChildren('selection', { read: ElementRef })
  selections!: QueryList<ElementRef>;

  protected searchFocused = signal(false);

  constructor() {
    this.debounced$
      .pipe(
        debounceTime(100),
        distinctUntilChanged(),
        filter(text => text.length >= 3),
        switchMap(text => {
          const abrt = new AbortController();

          return from(this.searchCustomers(text, abrt.signal)).pipe(
            catchError(err => {
              toast.error('Kundendaten konnten nicht durchsucht werden', {
                description: ConnectError.from(err).message,
              });

              return of(new SearchCustomerResponse());
            }),
            finalize(() => {
              abrt.abort();
              this.searchinProgress.set(false);
            })
          );
        }),
        takeUntilDestroyed()
      )
      .subscribe(response => {
        this.focusedIndex.set(0);

        this.matchingCustomers.set(
          (response.results || []).map(r => new CustomerModel(r.customer))
        );
      });

    effect(() => {
      let idx = untracked(() => this.focusedIndex());
      const customerResult = this.customers();
      const patientResult = this.patients();

      console.log(idx, patientResult.length)
      if (this.selectedCustomer()) {
        if (idx >= customerResult.length) {
          this.focusedIndex.set(0)
        }
      } else {
        if (idx >= patientResult.length) {
          this.focusedIndex.set(0)
        }
      }
    }, { allowSignalWrites: true })

    effect(
      () => {
        const text = this.customerSearchText();

        if (text.length < 3) {
          this.matchingCustomers.set([]);
          this.searchinProgress.set(false);
        } else {
          this.searchinProgress.set(true);
        }

        this.debounced$.next(text);
      },
      { allowSignalWrites: true }
    );

    effect(
      () => {
        const customer = this.selectedCustomer();
        this.customerPatients.set([]);
        this.selectedPatients.set([]);
        this.focusedIndex.set(0)
        this.searchFocused.set(false);

        if (!customer) {
          return;
        }

        if (!customer.isUnknow) {
          this.patientService
            .getPatientsByCustomer({
              customerId: customer.id,
            })
            .catch(err => {
              toast.error('Patientendaten konnten nicht geladen werden', {
                description: ConnectError.from(err).message,
              });

              return new GetPatientsByCustomerResponse();
            })
            .then(response => {
              let m = new Map<string, Species>();
              response.species
                ?.forEach(s => m.set(s.name, s))

              this.customerPatients.set(
                response.patients
                  ?.map(p => new PatientWithSpecies(p, m.get(p.assignedSpeciesName))) || []);
            });
        }
      },
      { allowSignalWrites: true }
    );
  }

  ngOnInit() {
    this.loadRecentCalls();

    if (this.context) {

      if ('calendarId' in this.context) {
        this.selectedCalendarId.set(this.context.calendarId)
        this.dateTime.set(this.context.dateTime)
      } else
      if ('customerId' in this.context) {
        if (this.context.isUnknown) {
          this.selectedCustomer.set(new CustomerModel(this.context.customerId))
        } else {
        this.customerService
          .searchCustomer({
            queries: [
              {
                query: {
                  case: 'id',
                  value: this.context.customerId,
                }
              }
            ]
          })
          .then(response => {
            if (!response.results?.length) {
              throw new Error('Kunde nicht gefunden')
            }

            this.selectedCustomer.set(new CustomerModel(response.results[0].customer))
          })
          .catch(err => {
            toast.error('Kunde konnte nicht geladen werden', {
              description: ConnectError.from(err).message
            })
          })
        }
      }
    }

    this.calendarService
      .listCalendars({})
      .then(response => {
        this.calendars.set(response.calendars || [])
      })
      .catch(err => {
        toast.error('Kalendar konnten nicht geladen werden', {
          description: ConnectError.from(err).message
        })
      })
  }

  ngAfterViewInit(): void {
    this.patientDescriptionInputs.changes
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        let last: HTMLInputElement =
          this.patientDescriptionInputs.last?.nativeElement;

        if (this.patientDescriptionInputs.length > 1) {
          last = this.patientDescriptionInputs.get(this.patientDescriptionInputs.length - 2).nativeElement
        }

        if (!last) {
          return;
        }

        if (!last.value) {
          last.focus();
        }
      });
  }

  private searchCustomers(
    text: string,
    signal: AbortSignal
  ): Promise<SearchCustomerResponse> {
    let queries: PartialMessage<CustomerQuery>[];

    if (text[0] === '+' || !isNaN(+text[0])) {
      queries = [
        {
          query: {
            case: 'phoneNumber',
            value: text,
          },
        },
      ];
    } else if (text.includes('@')) {
      queries = [
        {
          query: {
            case: 'emailAddress',
            value: text,
          },
        },
      ];
    } else {
      const parts = text.split(' ').filter(p => p.trim() !== '');

      queries = [
        {
          query: {
            case: 'name',
            value: {
              lastName: parts[0],
              firstName: parts.length > 1 ? parts[1] : undefined,
            },
          },
        },
      ];

      if (parts.length > 1) {
        queries.push({
          query: {
            case: 'name',
            value: {
              firstName: parts[0],
              lastName: parts[1],
            },
          },
        });
      }
    }

    return this.customerService.searchCustomer(
      {
        queries,
      },
      { signal }
    );
  }

  private loadRecentCalls() {
    const now = new Date();
    const before = addMinutes(now, -50);

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
              return new CustomerModel(record.caller);
            }

            return new CustomerModel(customer);
          });

        const m = new Map<string, CustomerModel>();
        logs.forEach(l => m.set(l.id, l));

        const values = Array.from(m.values());
        this.recentCalls.set(values);
      })
      .catch(err => {
        console.error(err);
      });
  }

  protected createEvent() {
    let name = `${this.selectedCustomer().lastName} ${this.selectedCustomer().firstName}`.trim();
    if (this.computedSummary() !== '') {
      name += ": " + this.computedSummary()
    }

    let a: Any | undefined;

    if (!this.selectedCustomer().isUnknow) {
      const annotation = new CustomerAnnotation({
        customerId: this.selectedCustomer().id,
        animalIds: this.selectedPatients().map(p => p.patientId),
        eventDescription: this.description(),
        additionalAnimalText: this.freeSummaryText(),
        animalDescriptions: {}
      })

      this.selectedPatients()
        .forEach(p => {
          annotation.animalDescriptions[p.patientId] = p.description() 
        })

      a = Any.pack(annotation)
    }

    let req = new CreateEventRequest({
      calendarId: this.selectedCalendarId(),
      description: this.description(),
      name,
      start: Timestamp.fromDate(this.dateTime()),
      end: Timestamp.fromDate(addSeconds(this.dateTime(), Duration.parseString(this.duration()).seconds)),
      extraData: a,
    })

    this.calendarService
      .createEvent(req)
      .then(() => {
        this.close()
      })
      .catch(err => {
        toast.error('Termin konnte nicht erstellt werden', {
          description: ConnectError.from(err).message
        })
      })
  }
}
