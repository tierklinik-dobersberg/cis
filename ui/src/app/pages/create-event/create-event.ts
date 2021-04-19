import { Component, OnDestroy, OnInit } from "@angular/core";
import { forkJoin, of, Subject } from "rxjs";
import { catchError, debounceTime, filter, startWith, switchMap, takeUntil } from "rxjs/operators";
import { CalllogAPI, LocalPatient, PatientAPI, ProfileWithAvatar, Roster, RosterAPI, UserService, Day, OpeningHoursAPI, OpeningHour, OpeningHoursResponse, LocalEvent, Calendar, CalendarAPI } from "src/app/api";
import { Customer, CustomerAPI } from "src/app/api/customer.api";
import { HeaderTitleService } from "src/app/shared/header-title";
import { Duration } from "src/utils/duration";

interface DisplayCustomer extends Customer {
    display: string;
}

interface TimeSlot {
    from: Date;
    to: Date;
    isOpeningHour: boolean;
    users: {
        [username: string]: LocalEvent[]
    };
    available: {
        [username: string]: boolean;
    };
    highlighted: boolean;
}

@Component({
    templateUrl: './create-event.html',
    styleUrls: ['./create-event.scss'],
})
export class CreateEventComponent implements OnInit, OnDestroy {
    selectedCustomer: DisplayCustomer | null = null;
    customerSearchResult: DisplayCustomer[] = [];
    calllogSuggestions: DisplayCustomer[] = [];

    selectedPatients: (LocalPatient | string)[] = [];
    customerPatients: LocalPatient[] = [];
    selectedDate: Date | null = new Date();
    isHoliday: boolean | null = null;
    openingHours: OpeningHour[] | null = null;
    timeSlots: TimeSlot[] = [];
    rosterDay: Day | null = null;
    allUsers: ProfileWithAvatar[] = [];
    highlightedUserSlot: string = '';

    rosterLoading = false;
    customersLoading = false;
    patientsLoading = false;

    private searchCustomer$ = new Subject<string>();
    private loadPatient$ = new Subject<DisplayCustomer | null>();
    private loadDate$ = new Subject<Date | null>();
    private destroy$ = new Subject<void>();

    constructor(
        private headerService: HeaderTitleService,
        private customerapi: CustomerAPI,
        private calllogapi: CalllogAPI,
        private patientapi: PatientAPI,
        private rosterapi: RosterAPI,
        private calendarapi: CalendarAPI,
        private openinghoursapi: OpeningHoursAPI,
        private users: UserService,
    ) { }

    selectDate(date: Date | null) {
        this.rosterLoading = true;
        this.loadDate$.next(date);
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

    nextDay() {
        if (!this.selectedDate) {
            return;
        }
        this.selectedDate = new Date(this.selectedDate.getTime() + 24 * 60 * 60 * 1000);
        this.selectDate(this.selectedDate);
    }

    prevDay() {
        if (!this.selectedDate) {
            return;
        }
        this.selectedDate = new Date(this.selectedDate.getTime() - 24 * 60 * 60 * 1000);
        this.selectDate(this.selectedDate);
    }

    ngOnInit() {
        this.headerService.set('Termin eintragen');

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

        this.loadDate$.pipe(
            takeUntil(this.destroy$),
            debounceTime(500),
            startWith(new Date()),
            switchMap(date => {
                if (!date) {
                    return of(null as null);
                }
                return forkJoin({
                    date: of(date),
                    roster: this.rosterapi.forMonth(date.getFullYear(), date.getMonth() + 1).pipe(
                        catchError(err => of(null as Roster))
                    ),
                    openinghours: this.openinghoursapi.getOpeningHours(date).pipe(
                        catchError(err => {
                            console.error(err);
                            return of(null as OpeningHoursResponse);
                        })
                    ),
                    events: this.calendarapi.listEvents(date).pipe(
                        catchError(err => {
                            console.error(err);
                            return of(null as LocalEvent[])
                        })
                    )
                })
            })
        ).subscribe(roster => {
            this.isHoliday = null;
            this.openingHours = null;
            this.timeSlots = null;
            this.rosterLoading = false;
            this.rosterDay = null;

            this.rosterDay = !!roster && roster.roster && roster.roster.days[roster.date.getDate()];
            if (!!roster.openinghours) {
                this.isHoliday = roster.openinghours.isHoliday;
                this.openingHours = roster.openinghours.openingHours;
                this.updateTimeSlots(this.openingHours, this.rosterDay, roster.events);
            }
        });
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    highlightSlot(user: string, slot: TimeSlot | null) {
        if (slot === null) {
            this.highlightedUserSlot = '';
            this.timeSlots.forEach(slot => slot.highlighted = false)
            return;
        }
        this.highlightedUserSlot = user;
        let ids = new Set<string>();
        (slot.users[user] || []).forEach(event => ids.add(event._id));

        this.timeSlots.forEach(s => {
            s.highlighted = (s.users[user] || []).some(event => ids.has(event._id))
        })
        console.log(Array.from(ids.values()), this.timeSlots.filter(slot => slot.highlighted))
    }

    private updateTimeSlots(openinghours: OpeningHour[], day?: Day, events?: LocalEvent[]) {
        let earliestDate: Date | null = null;
        let latestDate: Date | null = null;

        openinghours.forEach(frame => {
            if (earliestDate === null || frame.from.getTime() < earliestDate.getTime()) {
                earliestDate = frame.from;
            }

            if (latestDate === null || frame.to.getTime() > latestDate.getTime()) {
                latestDate = frame.to;
            }
        });

        if (earliestDate === null) {
            // TODO(ppacher): no opening hour on that day
            return;
        }

        let isInFrame = (d: Date) => {
            const ts = d.getTime();
            return openinghours.some(frame => frame.from.getTime() <= ts && frame.to.getTime() >= ts)
        }

        let eventMap = new Map<string, LocalEvent[]>();
        (events || []).forEach(event => {
            if (!event.username) {
                return;
            }
            console.log(event);
            let arr = eventMap.get(event.username) || [];
            arr.push(event),
                eventMap.set(event.username, arr);
        })

        const slotSize = Duration.minutes(15);
        const threshold = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), earliestDate.getDate(), 12, 0, 0).getTime()

        let userSet = new Set([
            ...day?.forenoon,
            ...day?.afternoon,
            ...day?.onCall.day,
            ...day?.onCall.night,
        ]);
        this.allUsers = [];
        userSet.forEach(user => {
            this.allUsers.push(this.users.byName(user))
        });

        this.timeSlots = [];
        for (let iter = earliestDate; iter.getTime() < latestDate.getTime(); iter = slotSize.addTo(iter)) {
            let usersSlot: string[];
            let isOpeningHour = isInFrame(iter);
            let end = slotSize.addTo(iter);

            if (!isOpeningHour) {
                // FIXME(ppacher): expose day/night shift changes
                usersSlot = [...day?.onCall.day, ...day?.onCall.night];
            } else if (iter.getTime() <= threshold) {
                usersSlot = day?.forenoon;
            } else {
                usersSlot = day?.afternoon;
            }

            let users: TimeSlot['users'] = {};
            let available: TimeSlot['available'] = {};
            (usersSlot || []).forEach(user => {
                users[user] = (eventMap.get(user) || []).filter(event => {
                    if (!event.endTime) {
                        return false;
                    }

                    let eventStart = event.startTime.getTime();
                    let eventEnd = event.endTime!.getTime();
                    let slotStart = iter.getTime();

                    return slotStart >= eventStart && slotStart < eventEnd;
                });
                available[user] = true;
            })

            this.timeSlots.push({
                from: iter,
                to: end,
                users: users,
                available: available,
                isOpeningHour: isOpeningHour,
                highlighted: false,
            })
        }
        console.log(this.timeSlots);
    }
}