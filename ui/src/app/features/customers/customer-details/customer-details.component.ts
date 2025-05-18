import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, effect, inject, signal, TemplateRef, ViewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ConnectError } from '@connectrpc/connect';
import { lucideUser2 } from '@ng-icons/lucide';
import { BrnTabsDirective } from '@spartan-ng/ui-tabs-brain';
import { HlmBadgeModule } from '@tierklinik-dobersberg/angular/badge';
import { HlmCardModule } from '@tierklinik-dobersberg/angular/card';
import { injectCalendarService, injectCustomerService, PATIENT_SERVICE } from '@tierklinik-dobersberg/angular/connect';
import { HlmIconComponent, provideIcons } from '@tierklinik-dobersberg/angular/icon';
import { ToDatePipe } from '@tierklinik-dobersberg/angular/pipes';
import { HlmTableModule } from '@tierklinik-dobersberg/angular/table';
import { HlmTabsModule } from '@tierklinik-dobersberg/angular/tabs';
import { CalendarEvent, ListEventsResponse } from '@tierklinik-dobersberg/apis/calendar/v1';
import {
  Anamnesis,
  Customer,
  GetPatientsByCustomerResponse,
  ImportState,
  Patient,
  PatientGender
} from '@tierklinik-dobersberg/apis/customer/v1';
import { toast } from 'ngx-sonner';
import { distinctUntilChanged, map, Subscription, switchMap } from 'rxjs';
import { AppEventListComponent } from 'src/app/components/event-list';
import { HeaderTitleService } from 'src/app/layout/header-title';
import { CustomerDetailsTableComponent } from '../customer-details-table';

@Component({
  standalone: true,
  templateUrl: './customer-details.component.html',
  imports: [HlmTableModule, HlmTabsModule, HlmCardModule, CustomerDetailsTableComponent, ToDatePipe, HlmBadgeModule, DatePipe, HlmIconComponent, BrnTabsDirective, AppEventListComponent],
  providers: [
    ...provideIcons({
        lucideUser2
    })
  ]
})
export class CustomerDetailsComponent {
  private readonly customerService = injectCustomerService();
  private readonly patientService = inject(PATIENT_SERVICE);
  private readonly calendarService = injectCalendarService();
  private readonly headerService = inject(HeaderTitleService)
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router)
  private readonly destroyRef = inject(DestroyRef)

  private readonly customerAppointmentsById = signal<CalendarEvent[]>([])
  private readonly customerAppointmentsByName = signal<CalendarEvent[]>([])

  protected readonly customerAppointments = computed(() => {
    const byId = this.customerAppointmentsById();
    const byName = this.customerAppointmentsByName();
    const customer = this.customer();

    let values: string[] = [
      ...customer.firstName
        .split(" ")
        .map(e => e.toLocaleLowerCase())
        .filter(e => e != 'und'),
    ]

    let set = new Set<string>();
    let events: CalendarEvent[] = [];

    byId.forEach(e => {
      const sum = e.summary.toLocaleLowerCase();
      const desc = e.description.toLocaleLowerCase();

      if (!values.some(v => sum.includes(v)) && !values.some(v => desc.includes(v))) {
        return
      }

      events.push(e)
      set.add(e.calendarId + ' ' + e.id)
    })

    byName.forEach(e => {
      const sum = e.summary.toLocaleLowerCase();
      const desc = e.description.toLocaleLowerCase();

      if (set.has(e.calendarId + ' ' + e.id)) {
        return
      }

      if (!values.some(v => sum.includes(v)) && !values.some(v => desc.includes(v))) {
        return
      }

      events.push(e)
    })

    return events;
  })

  protected readonly customer = signal<Customer | null>(null);
  protected readonly states = signal<ImportState[]>([])
  protected readonly patients = signal<Patient[]>([]);
  protected readonly selectedPatient = signal<Patient | null>(null)
  protected readonly url = toSignal(this.route.queryParamMap);

  protected selectedPatientGender = computed(() => {
    const p = this.selectedPatient()
    if (!p) {
      return ''
    }

    switch (p.gender) {
      case PatientGender.FEMALE:
      case PatientGender.FEMALE_CASTRATED:
        return 'weiblich'
      case PatientGender.MALE: 
      case PatientGender.MALE_CASTRATED:
        return 'männlich'

      default:
        return 'N/A'
    }
  })

  protected selectedPatientAnamnesis = signal<Anamnesis[]>([]);

  protected selectedPatientCastrated = computed(() => {
    const p = this.selectedPatient()
    if (!p) {
      return ''
    }

    switch (p.gender) {
      case PatientGender.UNSPECIFIED:
        return null

      case PatientGender.FEMALE:
      case PatientGender.MALE: 
        return false

      default:
        return true
    }
  })

  protected selectedPatientAppointments = computed(() => {
    const patient = this.selectedPatient();
    const events = this.customerAppointments();
    const name = patient.patientName.toLocaleLowerCase();

    return events.filter(e => e.summary.toLocaleLowerCase().includes(name))
  })

  protected selectedTab = computed(() => {
    if (this.url().has("tab")) {
      return this.url().get("tab")
    }

    return "customer"
  })

  private _tabSub: Subscription = Subscription.EMPTY;
  @ViewChild(BrnTabsDirective, { static: false})
  set tabDirective( dir: BrnTabsDirective ) {
    this._tabSub.unsubscribe();

    if (!dir) {
      return
    }

    this._tabSub = dir.tabActivated
      .pipe(
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(e => this.onTabActivated(e));
  }

  @ViewChild('icon', { read: TemplateRef, static: true})
  iconTmpl!: TemplateRef<unknown>;

  protected selectPatient(p: Patient) {
    this.router
      .navigate(['/customers', this.customer().id,  'patient', p.patientId], {queryParamsHandling: 'preserve'})
  }

  protected onTabActivated(event: any) {
    this.router.navigate(['.'], {relativeTo: this.route, queryParams: {
      tab: event,
    }, queryParamsHandling: 'merge'})
  }

  constructor() {
    let ctrl: AbortController | null = null;

    let amCtrl: AbortController | null = null;
    effect(() => {
      const p = this.selectedPatient()
      if (!p) {
        return
      }

      if (amCtrl) {
        amCtrl.abort();
      }

      this.patientService
        .getAnamnesis({
          patientId: p.patientId,
        })
        .finally(() => amCtrl = null)
        .then(res => {
          this.selectedPatientAnamnesis.set((res.anamnesis || []).reverse());
        })
        .catch(err => {
          toast.error('Behandlungsdaten konnten nicht geladen werden', {
            description: ConnectError.from(err).message
          })
        })
    })

    effect(() => {
      const customer = this.customer();
      if (!customer) {
        return
      }

      // load calendar events
      this.calendarService
        .listEvents({
          source: {
            case: 'allCalendars',
            value: true
          },
          searchTime: {
            case: 'timeRange',
            value: {}
          },
          customerId: customer.id,
        })
        .catch(err => {
          toast.error('Kunden-Termine konnten nicht geladen werden', {
            description: ConnectError.from(err).message,
          })

          return new ListEventsResponse
        })
        .then(response => {
          let events: CalendarEvent[] = [];

          response.results
            ?.forEach(c => {
              c.events?.forEach(e => {
                events.push(e)
              })
            })

          this.customerAppointmentsById.set(events)
        })

      this.calendarService
        .listEvents({
          source: {
            case: 'allCalendars',
            value: true
          },
          searchText: customer.lastName,
          searchTime: {
            case: 'timeRange',
            value: {}
          },
        })
        .catch(err => {
          toast.error('Kunden-Termine konnten nicht geladen werden', {
            description: ConnectError.from(err).message,
          })

          return new ListEventsResponse
        })
        .then(response => {
          let events: CalendarEvent[] = [];

          response.results
            ?.forEach(c => {
              c.events?.forEach(e => {
                  events.push(e)
              })
            })

          this.customerAppointmentsByName.set(events)
        })

      // Load patient data
      this.patientService
        .getPatientsByCustomer({
          customerId: customer.id,
        })
        .catch(err => {
          const cerr = ConnectError.from(err);
          toast.error('Patientendaten konnten nicht geladen werden', {
            description: cerr.message
          })

          return new GetPatientsByCustomerResponse
        })
        .then(response => {
          this.patients.set(response.patients)

          const id = this.route.snapshot.paramMap.get("patientId");

          if (id && id !== 'none') {
            this.selectedPatient.set(this.patients().find(p => p.patientId === id) || null)
          } else if (response.patients?.length > 0) {
            this.selectPatient(response.patients[0])
          }
        })
    })

    this.route.paramMap.pipe(
      map(params => params.get("patientId")),
      takeUntilDestroyed(),
    )
    .subscribe(patientId => {
      if (!patientId) {
        return
      }

      this.selectedPatient.set(this.patients().find(p => p.patientId === patientId) || null)
    })

    this.route.paramMap.pipe(
      map(params => params.get('customerId')),
      distinctUntilChanged(),
      takeUntilDestroyed(),
      switchMap(id => {
        if (ctrl !== null) {
            ctrl.abort()
        }

        ctrl = new AbortController();

        return this.customerService
          .searchCustomer({
            queries: [
              {
                query: {
                  case: 'id',
                  value: id,
                },
              },
            ],
          }, { signal: ctrl.signal })
          .finally(() => {
            ctrl = null;
          })
          .then(response => {
            if (!response.results || response.results.length === 0) {
                return null
            }

            return response.results[0];
          })
      }),
    )
    .subscribe(customer => {
        if (!customer) {
            toast.error('Kunde konnte nicht gefunden werden')
            this.customer.set(null)
            this.router.navigate(['..'], { relativeTo: this.route })
        } else {
            this.customer.set(customer.customer)
            this.states.set(customer.states)
            this.headerService.set(customer.customer.lastName + ' ' + customer.customer.firstName, undefined, this.iconTmpl, [
                {
                    name: 'Kunden',
                    route: '/customers'
                },
            ])
        }
    });
  }
}
