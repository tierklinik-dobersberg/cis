import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  IterableDifferFactory,
  IterableDiffers,
  OnDestroy,
  OnInit,
  TrackByFunction
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Permission } from '@tkd/api';
import { NzMessageService } from 'ng-zorro-antd/message';
import { ThemeService } from 'ng2-charts';
import { forkJoin, Observable, of, Subject } from 'rxjs';
import {
  catchError,
  map,
  debounceTime,
  filter,
  switchMap,
  take,
  takeUntil,
  finalize
} from 'rxjs/operators';
import {
  Calendar,
  CalendarAPI,
  ConfigAPI,
  IdentityAPI,
  PasswordStrenght,
  Role,
  UserDetails, UserService
} from 'src/app/api';
import { Roster2Service, WorkTime } from 'src/app/api/roster2';
import { Breadcrump, HeaderTitleService } from 'src/app/shared/header-title';
import { NamedOptionSpec } from 'src/app/shared/option-spec-input';
import { extractErrorMessage } from 'src/app/utils';
import { Duration, formatDate } from 'src/utils/duration';
import { getOperations } from '../permissions-view';

interface TranslatedStrength extends PasswordStrenght {
  text: string;
  color: string;
}

const ScoreTranslations = [
  'Sehr schlecht',
  'Schlecht',
  'Mäßig',
  'Gut',
  'Ausgezeichnet',
];

const ScoreColors = ['#DC2626', '#F87171', '#F59E0B', '#60A5FA', '#059669'];

const breadcrumps: Breadcrump[] = [
  { name: 'Administration', route: '/admin/' },
  { name: 'Benutzer', route: '/admin/identity/users/' },
];

@Component({
  templateUrl: './manage-user.html',
  styleUrls: ['./manage-user.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManageUserComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  editMode = false;

  name: string = '';
  fullname = '';
  emailAddresses: string[] = [''];
  phoneNumbers: string[] = [''];
  password = '';
  preview = '';
  previewError = false;
  file: File | null = null;
  color = '';
  createCalendar = false;
  needsPasswortChange = false;
  userProperties: NamedOptionSpec[] = [];

  properties: { [key: string]: any } = {};

  availableRoles: Role[] = [];
  availableCalendars: Calendar[] = [];
  calendar = '';
  roles: string[] = [];
  permissions: Permission[] = [];
  originalPermissions: Permission[] = [];

  showPasswordModal = false;
  showGeneratedPasswordModal = false;

  timePerWeek: string = '';

  newTimePerWeek: string = '';
  timeApplicableFrom: Date | null = null;

  showSetWorkTime = false;

  pwdStrength: TranslatedStrength | null = null;
  passwordModal = {
    password: '',
    repeat: '',
  };

  trackIndex: TrackByFunction<string> = (idx, _) => idx;

  private iterableDifferFactory: IterableDifferFactory;

  constructor(
    private headerService: HeaderTitleService,
    private identityapi: IdentityAPI,
    private userService: UserService,
    private nzMessageService: NzMessageService,
    private router: Router,
    private route: ActivatedRoute,
    private calendarapi: CalendarAPI,
    private configapi: ConfigAPI,
    private roster2: Roster2Service,
    private cdr: ChangeDetectorRef,
    iterableDiffers: IterableDiffers
  ) {
    this.iterableDifferFactory = iterableDiffers.find([]);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.loadPwdStrenth$.complete();
  }


  ngOnInit() {
    this.name = this.route.snapshot.paramMap.get('username');
    this.editMode = !!this.name;

    this.identityapi
      .getRoles()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (roles) => (this.availableRoles = roles),
        error: (err) =>
          this.nzMessageService.error(
            extractErrorMessage(
              err,
              'Benutzerrollen konnten nicht geladen werden'
            )
          ),
      });

    this.configapi.change
      .pipe(
        takeUntil(this.destroy$),
        filter((cfg) => !!cfg),
        take(1)
      )
      .subscribe((cfg) => {
        this.userProperties = (cfg.UserProperty || []).map((spec) => {
          return {
            name: spec.Name,
            default: spec.Default,
            description: spec.Description,
            displayName: spec.DisplayName,
            required: spec.Required,
            type: spec.Type,
            annotations: spec.Annotations,
          };
        });
      });

    if (this.editMode) {
      forkJoin({
        user: this.identityapi.getUser(this.name),
        workTime: this.roster2.workTimes.current()
          .pipe(
            catchError(err => of({})),
            map(result => result[this.name] as (WorkTime|undefined))
          )
      }).subscribe({
        next: ({user, workTime}) => {

          this.headerService.set(
            'Benutzer bearbeiten',
            'Bearbeite einen bereits existierenden Benutzeraccount.',
            null,
            breadcrumps
          );
          this.name = user.name;
          this.fullname = user.fullname;
          this.phoneNumbers = user.phoneNumbers || [''];
          this.emailAddresses = user.mail || [''];
          this.calendar = user.calendarID || '';
          this.properties = user.properties;
          this.preview = this.userService.byName(user.name).avatar || '';
          this.color = user.color || '';
          this.roles = user.roles || [];
          this.permissions = user.permissions || [];
          this.originalPermissions = [...this.permissions];
          this.timePerWeek = '';
          if (!!workTime) {
            this.timePerWeek = new Duration(workTime.timePerWeek).toString()
          }
          this.newTimePerWeek = this.timePerWeek;
          this.timeApplicableFrom = null;

          this.cdr.markForCheck();
        },

        error: (err) => {
          this.nzMessageService.error(
            extractErrorMessage(
              err,
              `Benutzer ${this.name} konnte nicht geladen werden`
            )
          );
          this.router.navigate(['/admin/identity/users']);
          this.cdr.markForCheck();
        },
      });
    } else {
      this.headerService.set(
        'Neuen Benutzer',
        'Erstelle einen neuen Benutzer',
        null,
        breadcrumps
      );
      // new users should likely change their password so perpare for that.
      this.needsPasswortChange = true;
    }

    this.calendarapi.listCalendars().subscribe({
      next: (calendars) => {
        this.availableCalendars = calendars || [];
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.nzMessageService.error(
          extractErrorMessage(err, 'Kalender konnten nicht geladen werden')
        );
        this.availableCalendars = [];
      },
    });

    this.loadPwdStrenth$
      .pipe(
        debounceTime(500),
        switchMap((pwd) => this.identityapi.testPassword(pwd)),
        takeUntil(this.destroy$)
      )
      .subscribe((res) => {
        this.pwdStrength = {
          ...res,
          color: ScoreColors[res.score],
          text: ScoreTranslations[res.score],
        };
      });
  }

  handleSetTimeCancel() {
    this.newTimePerWeek = this.timePerWeek;
    this.timeApplicableFrom = null;
    this.showSetWorkTime = false;

    this.cdr.markForCheck();
  }

  handleSetTimeSave() {
    if (this.editMode) {
      const newTimePerWeek = this.newTimePerWeek;
      this.roster2.workTimes.set({
        id: '',
        applicableFrom: this.timeApplicableFrom?.toISOString() || '',
        staff: this.name,
        timePerWeek: Duration.parseString(this.newTimePerWeek).nanoseconds,
        overtimePenaltyRatio: 0,
        undertimePenaltyRatio: 0
      })
      .pipe(finalize(() => this.handleSetTimeCancel()))
      .subscribe({
        next: () => {
          this.nzMessageService.success('Arbeitszeit erfolgreich geändert')
          this.timePerWeek = newTimePerWeek;
        },
        error: err => this.nzMessageService.error(extractErrorMessage(err, 'Arbeitszeit konnte nicht geändert werden'))
      })
    }
  }


  handleCancel() {
    this.password = '';
    this.showPasswordModal = false;
    this.showGeneratedPasswordModal = false;

    this.cdr.markForCheck();
  }

  handleGeneratedPasswordClose() {
    this.password = '';
    this.router.navigate(['/admin/identity/users']);

    this.cdr.markForCheck();
  }

  handleOk() {
    if (this.editMode) {
      this.identityapi
        .setUserPassword(this.name, this.passwordModal.password)
        .subscribe({
          error: (err) =>
            this.nzMessageService.error(
              extractErrorMessage(err, 'Passwort konnte nicht gesetzt werden')
            ),
          next: () =>
            this.nzMessageService.success('Passwort erfolgreich überschrieben'),
        });
    } else {
      this.password = this.passwordModal.password;
    }
    this.passwordModal = {
      password: '',
      repeat: '',
    };
    this.showPasswordModal = false;
    this.showGeneratedPasswordModal = false;

    this.cdr.markForCheck();
  }

  imagePreview(e: Event) {
    const file = (e.target as HTMLInputElement).files[0];
    this.file = file;

    const reader = new FileReader();
    reader.onload = () => {
      this.preview = reader.result as string;
      this.previewError = false;
      this.cdr.markForCheck();
    };
    reader.readAsDataURL(file);
  }

  private loadPwdStrenth$ = new Subject<string>();
  getPasswordStrength(pwd: string) {
    this.loadPwdStrenth$.next(pwd);
  }

  private getProfile(): UserDetails {
    return {
      name: this.name,
      fullname: this.fullname,
      phoneNumbers: this.phoneNumbers.filter((elem) => !!elem),
      mail: this.emailAddresses.filter((elem) => !!elem),
      color: this.color,
      calendarID: this.calendar || undefined,
      needsPasswordChange: this.needsPasswortChange,
      properties: this.properties,
      roles: this.roles,
      permissions: this.permissions,
    };
  }

  saveUser() {
    let updatePermissions: Observable<any> = of(null);
    const changes = getOperations(
      this.iterableDifferFactory,
      this.originalPermissions,
      this.permissions
    );
    if (!!changes) {
      let observables: Observable<any>[] = [];
      changes.forEachAddedItem((record) => {
        observables.push(
          this.identityapi.assignPermission('users', this.name, record.item)
        );
      });

      changes.forEachRemovedItem((record) => {
        if (!record.item.id) {
          return;
        }
        observables.push(
          this.identityapi.unassignPermission(
            'users',
            this.name,
            record.item.id
          )
        );
      });

      updatePermissions = forkJoin(observables);
    }

    let updateAvatar: Observable<any> = of(null);
    if (this.userService.byName(this.name).avatar !== this.preview) {
      updateAvatar = this.identityapi.uploadUserAvatar(this.name, this.file)
    }

    this.identityapi
      .editUser(this.getProfile())
      .pipe(
        switchMap(() => updatePermissions),
        switchMap(() => updateAvatar),
      )
      .subscribe({
        next: () => {
          if (this.newTimePerWeek !== '') {
            this.handleSetTimeSave()
          }

          this.nzMessageService.success(
            'Benutzer wurde erfolgreich gespeichert'
          );
          this.userService.reloadUsers();
        },
        error: (err) => {
          this.nzMessageService.error(
            extractErrorMessage(err, 'Benutzer konnte nicht gespeichert werden')
          );
        },
      });
  }

  createUser() {
    let createUser$: Observable<{ password: string; avatarError?: any }> =
      this.identityapi.createUser({
        ...this.getProfile(),
        password: this.password || undefined,
      });

    if (!!this.file) {
      createUser$ = createUser$.pipe(
        switchMap((result) => {
          return forkJoin({
            avatarError: this.identityapi
              .uploadUserAvatar(this.name, this.file)
              .pipe(catchError((err) => of(err))),
            password: of(!!result ? result.password : ''),
          });
        })
      );
    }

    createUser$.subscribe({
      next: (result) => {
        this.userService.reloadUsers();

        if (!!result.avatarError) {
          this.nzMessageService.error(
            extractErrorMessage(
              result.avatarError,
              'Avatar konnte nicht gesetzt werden'
            )
          );
        }

        if (!!result && !!result.password) {
          this.password = result.password;
          this.showGeneratedPasswordModal = true;
        } else {
          this.nzMessageService.success(
            `${this.fullname || this.name} wurde erfolgreich erstellt.`
          );
          this.router.navigate(['/admin/identity/users/edit', this.name]);
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.nzMessageService.error(
          extractErrorMessage(err, 'Benutzer konnte nicht erstellt werden')
        );
      },
    });
  }
}
