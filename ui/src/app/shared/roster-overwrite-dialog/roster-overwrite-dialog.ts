import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, TrackByFunction } from '@angular/core';
import { combineLatest, forkJoin, interval, Observable, of, OperatorFunction, Subject } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, startWith, switchMap, takeUntil } from 'rxjs/operators';
import { ConfigAPI, Day, DoctorOnDutyResponse, ExternalAPI, Overwrite, ProfileWithAvatar, QuickRosterOverwrite, RosterAPI, RosterUIConfig, UserService } from 'src/app/api';

/**
 * FIXME:
 *  - do not allow datepicker to select in the past
 *  - close on logout
 *  - change green when section is selected
 */

interface _DoctorOnDuty extends DoctorOnDutyResponse<Date> {
    users: ProfileWithAvatar[];
}

interface RosterState {
    actual: Overwrite;
    actualUser?: ProfileWithAvatar;
    onDuty: _DoctorOnDuty;
    planned: Day;
    nextDay: Day;
    plannedDay: ProfileWithAvatar[];
    plannedNight: ProfileWithAvatar[];
}

@Component({
    templateUrl: './roster-overwrite-dialog.html',
    styleUrls: ['./roster-overwrite-dialog.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RosterOverwriteDialog implements OnInit, OnDestroy {
    private destroy$          = new Subject();
    private checkOverlapping$ = new Subject<{to: Date, from: Date}>();

    /** A list of overwrites that overlap with the current one */
    overlapping: Overwrite[] = [];

    /** The currently active overwrite, if any */
    today: RosterState | null = null;

    /** Holds the roster state for the selected date */
    stateForDate: RosterState | null = null;

    /** A list of users that are preferable used as overwrites */
    preferredUsers: ProfileWithAvatar[] = [];

    /** A list of other users that can be used as overwrites */
    otherAllowedUsers: ProfileWithAvatar[] = [];

    /** Whether or not all users should be shown */
    showAllUsers = false;

    /** The name of the user that has been selected */
    selectedUser = '';

    /** The selected quick roster overwrite */
    selectedQuickTargetNumber = '';

    /** The time at which the overwrite should be effective */
    from: Date | null = null;

    /** The time until the overwrite should be effective */
    to: Date | null = null;

    /** The type of overwrite that is being created */
    overwriteType: 'day-shift' | 'night-shift' | 'both' | 'custom' | '' = '';

    /** A list of configured quick-settings  */
    quickSettings: QuickRosterOverwrite[];

    /** Whether or not direct phone-number overwrites are allowed */
    allowPhone = false;

    /** The custom phone number entered by the user if allowPhone is true */
    customPhoneNumber = '';

    /** TrackBy function for user profiles */
    readonly trackProfile: TrackByFunction<ProfileWithAvatar> = (_: number, p: ProfileWithAvatar) => p.name;

    /** TrackBy function for quick settings */
    readonly trackQuickSetting: TrackByFunction<QuickRosterOverwrite> = (_: number, s: QuickRosterOverwrite) => s.TargetNumber

    constructor(
        private roster: RosterAPI,
        private externalapi: ExternalAPI,
        private userService: UserService,
        private config: ConfigAPI,
        private cdr: ChangeDetectorRef,
    ){}

    onDateChange() {
        if (!this.from) {
            return;
        }
        if (this.overwriteType !== 'custom') {
            this.to = this.from;
        }
        this.checkOverlapping$.next({from: this.from, to: this.to});
    }

    /** @private template-only - select the user that should be used for the new overwrite */
    selectUser(u: string) {
        this.selectedUser = u;
        this.selectedQuickTargetNumber = '';
        this.customPhoneNumber = '';
    }

    /** @private template-only - selects the quick roster overwrite that should be used */
    selectQuickSetting(s: QuickRosterOverwrite) {
        this.selectedUser = '';
        this.selectedQuickTargetNumber = s.TargetNumber;
        this.customPhoneNumber = '';
    }

    /** @private template-only - called when the user enters a customer phone number */
    onCustomPhoneNumberChange() {
        this.selectedUser = '';
        this.selectedQuickTargetNumber = '';
    }

    ngOnInit() {
        this.destroy$ = new Subject();

        // load and watch preferred and other allowed users.
        const rosterConfig$ = this.config.change;
        combineLatest([ rosterConfig$, this.userService.updated ])
            .pipe(
                map( ([cfg]) => {
                    return {
                        cfg: cfg,
                        users: this.getEligibleUsers(cfg.Roster)
                    }
                }),
                takeUntil(this.destroy$)
            )
            .subscribe(c => {
                this.preferredUsers = c.users.preferred;
                this.otherAllowedUsers = c.users.others;
                this.quickSettings = c.cfg.QuickRosterOverwrites || [];
                this.allowPhone = c.cfg.Roster?.AllowPhoneNumberOverwrite || false;
                this.cdr.markForCheck();
            })

        // load and watch the currently active overwrite for this day
        interval(5000)
                .pipe(
                    startWith(-1),
                    takeUntil(this.destroy$),
                    map(() => new Date()),
                    this.toRosterState(),
                )
                .subscribe((active: RosterState) => {
                    console.log(active);

                    if (!!active.actual?.username) {
                        active.actualUser = this.userService.byName(active.actual.username);
                    }
                    this.today = active;

                    // if the overwriteType is not yet set and we don't have an active overwrite we try to
                    // figure out a reasonable default
                    if (this.overwriteType === '' && active.actual === null) {
                        this.from = new Date();

                        (() => {
                            if (!active.onDuty) {
                                console.log(`[DEBUG] choosing both because we don't have a roster`)
                                this.overwriteType = 'both';
                                return
                            }

                            // if we are already in the night shift the user likely wants to overwrite
                            // that one only
                            if (!active.onDuty.isDayShift && active.onDuty.isNightShift) {
                                console.log(`[DEBUG] choosing night-shift because we're already in it`)
                                this.overwriteType = 'night-shift';
                                return
                            }

                            if (active.planned) {
                                // either no special on-day duty is defined or day and night are set to the same values.
                                // in this case, the user likely want's to overwrite both
                                if (active.planned.onCall.day.join('-') === active.planned.onCall.night.join('-') || active.planned.onCall.day.length === 0) {
                                    console.log(`[DEBUG] choosing both because day and night are set to the same values`)
                                    this.overwriteType = 'both';
                                } else {
                                    console.log(`[DEBUG] choosing day-shift because day and night differ`)
                                    this.overwriteType = 'day-shift';
                                }
                            } else {
                                // there's no roster configured for today so we will likely need to
                                // overwrite the whole day.
                                console.log(`[DEBUG] choosing both because we don't even have a roster configured`)
                                this.overwriteType = 'both';
                            }
                        })()
                    }

                    this.cdr.markForCheck();
                });

        

        // check for overlapping overwrites.
        const overlapping$ = 
        this.checkOverlapping$
            .pipe(
                takeUntil(this.destroy$),
                debounceTime(100),
            );

        overlapping$
            .pipe(
                switchMap(r => this.roster.getOverwrites(r.from, r.to)),
                catchError(err => of([])),
            )
            .subscribe(overlapping => {
                this.overlapping = overlapping;
                this.cdr.markForCheck();
            });

        overlapping$
            .pipe(
                map(value => {
                    if (!!value.to && !!value.from && value.from.toDateString() === value.to.toDateString()) {
                        return value.from;
                    }
                    return null
                }),
                this.toRosterState()
            )
            .subscribe(state => {
                console.log(`state for `, state);
                this.stateForDate = state;
                this.cdr.markForCheck();
            })
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete()
    }

    /**
     * Returns a list of user profiles that match the given term.
     * If term is an empty string, all preferred users are returned.
     * 
     * @param term The search term to filter users
     */
    filterUsers(term: string): ProfileWithAvatar[] {
        if (term === '') {
            return this.preferredUsers;
        }

        const result: ProfileWithAvatar[] = [];
        const matchUser = (u: ProfileWithAvatar)  => {
            if (u.name.includes(term) || u.fullname.includes(term)) {
                result.push(u);
            }
        }

        this.preferredUsers.forEach(matchUser);
        this.otherAllowedUsers.forEach(matchUser);
        return result;
    }

    private toRosterState(): OperatorFunction<Date, RosterState> {
        return (src: Observable<Date>) => {
            return src.pipe(
                switchMap(
                    d => {
                        if (d === null) {
                            return of(null)
                        }

                        return forkJoin({
                            actual: this.roster.getActiveOverwrite(d)
                                .pipe(
                                    catchError(err => {
                                        if (!(err instanceof HttpErrorResponse) || err.status !== 404 ) {
                                            console.error(`Failed to get active overwrite`, err)
                                        }
                                        return of(null as (Overwrite|null));
                                    }),
                                ),
                            onDuty: this.externalapi.getDoctorsOnDuty({at: d, ignoreOverwrite: true})
                                .pipe(
                                    map(dod => {
                                        if (dod.isOverwrite) {
                                            console.error("Got an overwrite response although we told the API not to")
                                        }
                                        return {
                                            ...dod,
                                            users: dod.doctors.map(d => this.userService.byName(d.username))
                                        } as _DoctorOnDuty
                                    }),
                                    catchError(err => {
                                        return of(null as _DoctorOnDuty)
                                    })
                                ),
                            planned: this.roster.forDay(d)
                                .pipe(
                                    catchError(err => {
                                        if (!(err instanceof HttpErrorResponse) || err.status !== 404 ) {
                                            console.error(`Failed to get active roster`, err)
                                        }
                                        return of(null as (Day|null));
                                    }),
                                ),
                            nextDay: this.roster.forDay(new Date(d.getFullYear(), d.getMonth(), d.getDate()+1))
                                .pipe(
                                    catchError(err => {
                                        if (!(err instanceof HttpErrorResponse) || err.status !== 404 ) {
                                            console.error(`Failed to get active roster`, err)
                                        }
                                        return of(null as (Day|null));
                                    }),
                                ),
                        })
                    }
                ),
                map(result => {
                    if (result === null) {
                        return null;
                    }
                    return {
                        ...result,
                        plannedDay: result?.planned?.onCall.day.map(u => this.userService.byName(u)),
                        plannedNight: result?.planned?.onCall.night.map(u => this.userService.byName(u)),
                    }
                })
            )
        }
    }

    private getEligibleUsers(cfg: RosterUIConfig): {preferred: ProfileWithAvatar[], others: ProfileWithAvatar[]} {
        if (!cfg || !cfg.EligibleRolesForOverwrite?.length) {
            return {
                preferred: this.userService.snapshot,
                others: []
            }
        }

        const preferred = new Set<ProfileWithAvatar>();
        const otherUsers = new Set<ProfileWithAvatar>();

        cfg.EligibleRolesForOverwrite.forEach(
            role => this.userService.byRole(role).forEach(
                user => preferred.add(user)
            )
        );

        // Depending on AllowAnyUserOverwrite we might need to other non-preferred users
        // as well 
        if (cfg.AllowAnyUserAsOverwrite) {
            this.userService.snapshot.forEach(user => {
                if (!preferred.has(user)) {
                    otherUsers.add(user);
                }
            })
        }

        return {
            preferred: Array.from(preferred.values()),
            others: Array.from(otherUsers.values()),
        }
    }
}