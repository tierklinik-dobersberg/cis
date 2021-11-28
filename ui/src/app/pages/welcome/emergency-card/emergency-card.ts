import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, TrackByFunction } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { BehaviorSubject, combineLatest, forkJoin, interval, of, Subscription, throwError } from 'rxjs';
import { catchError, delay, mergeMap, retryWhen, startWith } from 'rxjs/operators';
import {
  ConfigAPI,
  Day,
  DoctorOnDuty,
  DoctorOnDutyResponse,
  ExternalAPI,
  IdentityAPI,
  Permission,
  ProfileWithAvatar,
  QuickRosterOverwrite,
  Roster,
  RosterAPI,
  UserService
} from 'src/app/api';
import { LayoutService } from 'src/app/services';
import { extractErrorMessage, toggleRouteQueryParamFunc } from 'src/app/utils';

@Component({
  selector: 'app-emergency-card',
  templateUrl: './emergency-card.html',
  styleUrls: ['./emergency-card.scss'],
  // changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmergencyCardComponent implements OnInit, OnDestroy {
  private subscriptions = Subscription.EMPTY;
  private reload = new BehaviorSubject<void>(undefined);

  onDuty: DoctorOnDuty[] = [];
  isOverwritten = false;
  onDutyUntil: Date | null = null;
  firstLoad = true;
  primaryOnDuty: ProfileWithAvatar | null = null;
  shiftKind: string = 'Bereitschaftsdienst';

  overwritePhone = '';
  drawerVisible = false;
  quickOverwrites: QuickRosterOverwrite[] = [];
  rosterDay: Day | null = null;

  allUsers: ProfileWithAvatar[] = [];

  trackBy: TrackByFunction<DoctorOnDuty> = (_: number, item: DoctorOnDuty) => item.username;

  constructor(
    private externalapi: ExternalAPI,
    private identityapi: IdentityAPI,
    private userService: UserService,
    private rosterapi: RosterAPI,
    private configapi: ConfigAPI,
    private nzMessageService: NzMessageService,
    private changeDetector: ChangeDetectorRef,
    private modal: NzModalService,
    private router: Router,
    private activeRoute: ActivatedRoute,
    public layout: LayoutService,
  ) { }

  readonly toggleDrawer = toggleRouteQueryParamFunc(this.router, this.activeRoute, 'roster-overwrite');

  get canSetOverwrite(): boolean {
    return this.identityapi.hasPermission(Permission.RosterSetOverwrite);
  }

  configureOverwrite(user?: string, overwritePhone?: string, disiplayName?: string): void {
    /*
    const configure = () => {
      this.rosterapi.setOverwrite({
        username: user || '',
        phoneNumber: overwritePhone || this.overwritePhone,
        displayName: disiplayName || '',
      }).subscribe(
        () => {
          this.nzMessageService.success('Dienstplan überschrieben.');
          this.drawerVisible = false;
          this.reload.next();
        },
        err => {
          this.nzMessageService.error(extractErrorMessage(err, 'Dienstplan konnte nicht überschrieben werden'));
        }
      );
    };
    // TODO(ppacher): inform user if we are overwritting to shifts (day and night) with different staff!
    configure();
    */
  }

  removeOverwrite(): void {
    /*
    this.rosterapi.deleteOverwrite()
      .subscribe(
        () => {
          this.nzMessageService.success('Dienstplan wiederhergestellt.');
          this.drawerVisible = false;
          this.reload.next();
        },
        err => {
          this.nzMessageService.error(extractErrorMessage(err, 'Dienstplan konnte nicht wiederhergestellt werden'));
        }
      );
      */
  }

  ngOnInit(): void {
    this.subscriptions = new Subscription();

    // watch route changes for "?roster-overwrite" query parameter
    // and open the drawer accordingly.
    const routerSub = this.activeRoute.queryParamMap
      .subscribe(params => {
        this.drawerVisible = params.has("roster-overwrite");
        this.overwritePhone = '';
        this.changeDetector.markForCheck();
      });
    this.subscriptions.add(routerSub);

    // get a list of all users including their avatars.
    const allUsersSub = this.userService.users
      .subscribe(users => {
        this.allUsers = users.filter(u => !u.disabled);
      });

    this.subscriptions.add(allUsersSub);

    // load all quick-overwrites defined in the configuration
    const configSub = this.configapi.change
      .subscribe(config => {
        if (!config) {
          return;
        }

        this.quickOverwrites = config.QuickRosterOverwrites || [];
      });
    this.subscriptions.add(configSub);


    // watch the current doctor-on-duty
    const sub = combineLatest([
      interval(20000).pipe(startWith(0)),
      this.reload
    ])
      .pipe(
        mergeMap(() => forkJoin({
          onDuty: this.externalapi.getDoctorsOnDuty()
            .pipe(
              catchError(err => {
                // we might get a 404 if there's no roster defined for today.
                if (err instanceof HttpErrorResponse && err.status === 404) {
                  return of({
                    doctors: [],
                    until: null,
                    isOverwrite: false,
                  } as DoctorOnDutyResponse<any>);
                }

                return throwError(err);
              }),
            ),
          roster: this.rosterapi.forMonth()
            .pipe(
              catchError(err => {
                if (err instanceof HttpErrorResponse && err.status === 404) {
                  return of(null as Roster);
                }
                return throwError(err);
              })
            )
        })),
        retryWhen(errors => errors.pipe(delay(5000))),
      )
      .subscribe({
        next: result => {
          this.firstLoad = false;
          this.onDuty = result.onDuty.doctors || [];
          this.onDutyUntil = result.onDuty.until;
          this.isOverwritten = result.onDuty.isOverwrite;

          if (result.onDuty.isOverwrite) {
            this.shiftKind = 'Bereitschaftsdienst (überschrieben)'
          } else
            if (result.onDuty.isDayShift && result.onDuty.isNightShift) {
              this.shiftKind = 'Bereitschaft (ganzer Tag)';
            } else if (result.onDuty.isDayShift) {
              this.shiftKind = 'Tag-Bereitschaft';
            } else if (result.onDuty.isNightShift) {
              this.shiftKind = 'Nacht-Bereitschaft';
            } else {
              this.shiftKind = 'Bereitschaftsdienst (unbekannt)'
            }

          this.rosterDay = null;
          if (!!result.roster) {
            this.rosterDay = result.roster.days[(new Date().getDate())];
            // TODO(ppacher): get on-call-change time frames
          }

          this.primaryOnDuty = this.userService.byName(this.onDuty[0]?.username);
          this.changeDetector.markForCheck();
        },
      });

    this.subscriptions.add(sub);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}

