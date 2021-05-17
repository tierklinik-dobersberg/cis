import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { animationFrameScheduler, forkJoin, Observable, of, Subject } from 'rxjs';
import { catchError, debounceTime, map, observeOn, share, switchMap, takeUntil } from 'rxjs/operators';
import { CalendarAPI, CalllogAPI, LocalPatient, PatientAPI, ProfileWithAvatar, Resource, ResourceAPI, UserService } from 'src/app/api';
import { Customer, CustomerAPI } from 'src/app/api/customer.api';
import { HeaderTitleService } from 'src/app/shared/header-title';
import { extractErrorMessage } from 'src/app/utils';
import { Duration } from 'src/utils/duration';
import { SelectedTime } from './quick-time-selector';

interface ResourceModel extends Resource {
    selected: boolean;
}

interface DisplayCustomer extends Customer {
    display: string;
}

@Component({
    templateUrl: './create-event.html',
    styleUrls: ['./create-event.scss'],
})
export class CreateEventComponent implements OnInit, OnDestroy {
    /** The currently selected customer */
    selectedCustomer: DisplayCustomer | null = null;

    /** A customers that match the search */
    customerSearchResult: DisplayCustomer[] = [];

    /** A suggestion of customers that called recently */
    calllogSuggestions: DisplayCustomer[] = [];

    /* selectedPatients may also be a string for new, unknown
       patients. */
    selectedPatients: (LocalPatient | string)[] = [];

    /* All patients that belong to customer */
    customerPatients: LocalPatient[] = [];

    /** the currently selected date. */
    selectedDate: Date | null = new Date();

    /** the currently selected time and user */
    selectedTime: SelectedTime | null = null;

    /* Available resources that might be required when creating
       new events */
    resources: ResourceModel[];

    /** emits when a new resource is selected as required. */
    private onSelectedResources$ = new Subject<void>();

    /** The list of resources that are required for this event */
    selectedResources: string[] = [];

    /** Whether or not we're currently loading customer data */
    customersLoading = false;

    /** Whether or not we're currently loading patient data */
    patientsLoading = false;

    /** The event's summary */
    summary = '';

    /** An additional description of the event */
    description = '';

    /** The name of the user that creates the event */
    createdBy = '';

    /** All available user names */
    users: Observable<ProfileWithAvatar[]> = this.userService.users
        .pipe(map(user => user.filter(u => !u.disabled)), share());

    private searchCustomer$ = new Subject<string>();
    private loadPatient$ = new Subject<DisplayCustomer | null>();
    private destroy$ = new Subject<void>();

    constructor(
        private headerService: HeaderTitleService,
        private calendarapi: CalendarAPI,
        private customerapi: CustomerAPI,
        private calllogapi: CalllogAPI,
        private patientapi: PatientAPI,
        private resourceapi: ResourceAPI,
        private userService: UserService,
        private activeRoute: ActivatedRoute,
        private nzMessageService: NzMessageService,
    ) { }

    /** @private - callback when the user selects a time via quick-time-selector. */
    onTimeSelected(time: SelectedTime) {
        this.selectedTime = time;
    }

    /**
     * Search and only display customers that match name.
     */
    searchCustomer(name: string) {
        this.searchCustomer$.next(name);
    }

    /**
     * Selects the customer for which the event should be created.
     *
     * @param customer The customer to select
     */
    selectCustomer(customer: DisplayCustomer | null) {
        this.selectedPatients = [];
        this.loadPatient$.next(customer);
    }

    /**
     * Moves on to the next day.
     */
    nextDay() {
        if (!this.selectedDate) {
            return;
        }
        this.selectedDate = new Date(this.selectedDate.getTime() + 24 * 60 * 60 * 1000);
    }

    /**
     * Moves back to the previous day.
     */
    prevDay() {
        if (!this.selectedDate) {
            return;
        }
        this.selectedDate = new Date(this.selectedDate.getTime() - 24 * 60 * 60 * 1000);
    }

    /**
     * Check if a date should be displayed as "not-allowed"
     * in the date-picker.
     *
     * @param d The date to check
     */
    disabledDate(d: Date) {
        const now = new Date();
        const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return d.getTime() < midnight.getTime();
    }

    /**
     * Resets the component to it's initial state
     */
    resetView() {
        this.selectCustomer(null);
        this.customerSearchResult = [];
        this.onSelectedResources$.next();
        this.summary = '';
        this.description = '';
        this.createdBy = '';
        this.selectedDate = new Date();
        this.selectedTime = null;
        this.selectedCustomer = null;
        this.selectedPatients = [];
        this.resources.forEach(r => r.selected = false);
    }

    createEvent() {
        this.calendarapi.createEvent({
            summary: this.summary,
            description: this.description,
            duration: this.selectedTime.duration,
            calendarID: this.selectedTime.calendarID,
            startTime: this.selectedTime.date,
            data: {
                customerID: this.selectedCustomer.cid,
                customerSource: this.selectedCustomer.source,
                animalID: this.selectedPatients.map(p => {
                    if (typeof p === 'string') {
                        return p
                    }
                    return p.animalID
                }),
                requiredResources: this.selectedResources,
                createdBy: this.createdBy
            }
        }).subscribe({
            next: () => {
                this.nzMessageService.success('Termin erfolgreich erstellt');
                this.resetView();
            },
            error: err => {
                this.nzMessageService.error(extractErrorMessage(err, 'Termin konnte nicht erstellt werden'))
            }
        })
    }

    /** @private - Emits onSelectedResources$ */
    updateResources() {
        this.onSelectedResources$.next();
    }

    ngOnInit() {
        this.headerService.set('Termin eintragen');

        this.onSelectedResources$.pipe(
            observeOn(animationFrameScheduler),
            takeUntil(this.destroy$),
            debounceTime(100),
        )
            .subscribe(() => {
                this.selectedResources = this.resources.filter(r => r.selected).map(r => r.id);
            });

        this.resourceapi.listResources()
            .subscribe(resources => this.resources = resources.map(r => ({
                ...r,
                selected: false,
            })));

        this.calllogapi.forToday()
            .pipe(
                takeUntil(this.destroy$),
                switchMap(calllogs => {
                    // TODO(ppacher): also accept calllogs where we don't know the number and
                    // ask the user to assign it. That's possible the easiest way to get phone - customer
                    // assignments done.
                    const recent = calllogs.filter(call => !!call.customerSource && call.customerSource !== 'unknown').slice(0, 10);
                    return forkJoin(
                        recent.map(call => this.customerapi.byId(call.customerSource!, call.customerID!))
                    );
                })
            )
            .subscribe(result => {
                if (result === null) {
                    return;
                }
                this.calllogSuggestions = result.map(customer => ({
                    ...customer,
                    display: `${customer.name} ${customer.firstname}, ${customer.street}, ${customer.city}`
                }));
                if (this.customerSearchResult.length === 0) {
                    this.customerSearchResult = this.calllogSuggestions;
                }
            });

        this.searchCustomer$.pipe(
            takeUntil(this.destroy$),
            debounceTime(500),
            switchMap(name => {
                this.customersLoading = true;
                if (name === '') {
                    return of(this.calllogSuggestions);
                }
                return this.customerapi.searchName(name);
            }),
        ).subscribe(customers => {
            this.customersLoading = false;
            this.customerSearchResult = customers.map(customer => ({
                ...customer,
                display: `${customer.name} ${customer.firstname}, ${customer.street}, ${customer.city}`
            }));
        });

        this.loadPatient$.pipe(
            takeUntil(this.destroy$),
            debounceTime(500),
            switchMap(customer => {
                this.patientsLoading = true;
                return this.patientapi.getPatientsForCustomer(customer.source, customer.cid);
            }),
            catchError(err => of([] as LocalPatient[]))
        ).subscribe(patients => {
            this.patientsLoading = false;
            this.customerPatients = patients;
        });

        this.activeRoute.queryParamMap
            .pipe(
                takeUntil(this.destroy$)
            )
            .subscribe(params => {
                const cal = params.get('calendar');
                const start = params.get('start');

                if (!!start && !!cal) {
                    const startTime = new Date(start);
                    this.selectedTime = {
                        date: startTime,
                        duration: Duration.minutes(15),
                        calendarID: cal,
                        user: this.userService.byCalendarID(cal)
                    }
                }
            })
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }
}
