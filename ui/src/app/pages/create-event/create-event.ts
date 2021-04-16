import { Component, OnDestroy, OnInit } from "@angular/core";
import { forkJoin, of, Subject } from "rxjs";
import { catchError, debounceTime, filter, switchMap, takeUntil } from "rxjs/operators";
import { CalllogAPI, LocalPatient, PatientAPI, ProfileWithAvatar, Roster, RosterAPI, UserService, Day } from "src/app/api";
import { Customer, CustomerAPI } from "src/app/api/customer.api";
import { HeaderTitleService } from "src/app/shared/header-title";

interface DisplayCustomer extends Customer {
    display: string;
}

interface DisplayDay extends Day {
    usersForenoon: ProfileWithAvatar[];
    usersAfternoon: ProfileWithAvatar[];
    usersEmergency: ProfileWithAvatar[];
}

@Component({
    templateUrl: './create-event.html',
    styleUrls: ['./create-event.scss'],
})
export class CreateEventComponent implements OnInit, OnDestroy {
    selectedCustomer: DisplayCustomer | null = null;
    customerSearchResult: DisplayCustomer[] = [];

    selectedPatients: (LocalPatient | string)[] = [];
    customerPatients: LocalPatient[] = [];
    rosterDay: DisplayDay | null = null;
    selectedDate: Date | null = null;

    rosterLoading = false;
    customersLoading = false;
    patientsLoading = false;

    private searchCustomer$ = new Subject<string>();
    private loadPatient$ = new Subject<DisplayCustomer | null>();
    private loadRoster$ = new Subject<Date | null>();
    private destroy$ = new Subject<void>();

    constructor(
        private headerService: HeaderTitleService,
        private customerapi: CustomerAPI,
        private calllogapi: CalllogAPI,
        private patientapi: PatientAPI,
        private rosterapi: RosterAPI,
        private users: UserService,
    ) { }

    selectDate(date: Date | null) {
        this.rosterLoading = true;
        this.loadRoster$.next(date);
    }

    searchCustomer(name: string) {
        this.searchCustomer$.next(name);
    }

    selectCustomer(customer: DisplayCustomer | null) {
        this.loadPatient$.next(customer);
    }

    selectPatient(event: any) {
        console.log(event);
    }

    ngOnInit() {
        this.headerService.set('Termin eintragen');

        this.calllogapi.forToday()
            .pipe(
                takeUntil(this.destroy$),
                switchMap(calllogs => {
                    if (this.customerSearchResult.length > 0) {
                        // abort if the user already searched for customers
                        return of(null as Customer[]);
                    }
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
                this.customerSearchResult = result.map(customer => ({
                    ...customer,
                    display: `${customer.name} ${customer.firstname}, ${customer.street}, ${customer.city}`
                }));
            })

        this.searchCustomer$.pipe(
            takeUntil(this.destroy$),
            debounceTime(500),
            filter(name => name != ""),
            switchMap(name => {
                this.customersLoading = true;
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

        this.loadRoster$.pipe(
            takeUntil(this.destroy$),
            debounceTime(500),
            switchMap(date => {
                if (!date) {
                    return of(null as null);
                }
                return forkJoin({
                    date: of(date),
                    roster: this.rosterapi.forMonth(date.getFullYear(), date.getMonth() + 1).pipe(
                        catchError(err => of(null as Roster))
                    ),
                })
            })
        ).subscribe(roster => {
            this.rosterLoading = false;
            if (!roster) {
                return;
            }
            this.rosterDay = null;
            if (roster.roster === null) {
                return;
            }
            const day = roster.roster.days[roster.date.getDate()];
            if (!day) {
                return;
            }
            // make sure we actually have some users configued. otherwise this still counts
            // as "no-roster".
            if (day.forenoon.length === 0 && day.afternoon.length === 0 && day.emergency.length === 0) {
                return;
            }
            this.rosterDay = {
                ...day,
                usersForenoon: (day.forenoon || []).map(user => this.users.byName(user)),
                usersAfternoon: (day.afternoon || []).map(user => this.users.byName(user)),
                usersEmergency: (day.emergency || []).map(user => this.users.byName(user)),
            }
        });
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }
}