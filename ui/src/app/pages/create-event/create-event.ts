import { Component, OnDestroy, OnInit } from "@angular/core";
import { animationFrameScheduler, forkJoin, of, Subject } from "rxjs";
import { catchError, debounceTime, observeOn, switchMap, takeUntil } from "rxjs/operators";
import { CalendarAPI, CalllogAPI, LocalPatient, OpeningHoursAPI, PatientAPI, Resource, ResourceAPI, RosterAPI, UserService } from "src/app/api";
import { Customer, CustomerAPI } from "src/app/api/customer.api";
import { HeaderTitleService } from "src/app/shared/header-title";
import { SelectedTime } from "./quick-time-selector";

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

    private onSelectedResources$ = new Subject<void>();
    selectedResources: string[] = [];

    customersLoading = false;
    patientsLoading = false;

    private searchCustomer$ = new Subject<string>();
    private loadPatient$ = new Subject<DisplayCustomer | null>();
    private destroy$ = new Subject<void>();

    constructor(
        private headerService: HeaderTitleService,
        private customerapi: CustomerAPI,
        private calllogapi: CalllogAPI,
        private patientapi: PatientAPI,
        private resourceapi: ResourceAPI,
    ) { }

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
            })

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
                    let recent = calllogs.filter(call => !!call.customerSource && call.customerSource !== 'unknown').slice(0, 10);
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
            })

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
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }
}