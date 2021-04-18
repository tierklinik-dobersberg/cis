import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, TrackByFunction } from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { BehaviorSubject, combineLatest, interval, of, Subscription, throwError } from 'rxjs';
import { catchError, delay, mergeMap, retryWhen, startWith } from 'rxjs/operators';
import {
  ConfigAPI,
  DoctorOnDuty,
  ExternalAPI,
  IdentityAPI,
  Permission,
  ProfileWithAvatar,
  QuickRosterOverwrite,
  RosterAPI,
  UserService
} from 'src/app/api';
import { LayoutService } from 'src/app/services';
import { extractErrorMessage } from 'src/app/utils';

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

  overwritePhone = '';
  drawerVisible = false;
  quickOverwrites: QuickRosterOverwrite[] = [];

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
    public layout: LayoutService,
  ) { }

  toggleDrawer(): void {
    this.drawerVisible = !this.drawerVisible;
    this.overwritePhone = '';
  }

  get canSetOverwrite(): boolean {
    return this.identityapi.hasPermission(Permission.RosterSetOverwrite);
  }

  configureOverwrite(user?: string, overwritePhone?: string, disiplayName?: string): void {
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
  }

  removeOverwrite(): void {
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
  }

  ngOnInit(): void {
    this.subscriptions = new Subscription();

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
        mergeMap(() => this.externalapi.getDoctorsOnDuty()),
        catchError(err => {
          // we might get a 404 if there's no roster defined for today.
          if (err instanceof HttpErrorResponse && err.status === 404) {
            return of({
              doctors: [],
              until: null,
              isOverwrite: false,
            });
          }

          return throwError(err);
        }),
        retryWhen(errors => errors.pipe(delay(5000))),
      )
      .subscribe({
        next: result => {
          this.firstLoad = false;
          this.onDuty = result.doctors || [];
          this.onDutyUntil = result.until;
          this.isOverwritten = result.isOverwrite;

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

