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
import { NzMessageService } from 'ng-zorro-antd/message';
import { forkJoin, Observable, of, Subject } from 'rxjs';
import {
  catchError,
  debounceTime,
  filter,
  switchMap,
  take,
  takeUntil
} from 'rxjs/operators';
import {
  Calendar,
  CalendarAPI,
  ConfigAPI,
  IdentityAPI,
  PasswordStrenght,
  Permission,
  Role,
  UserDetails, UserService
} from 'src/app/api';
import { Breadcrump, HeaderTitleService } from 'src/app/shared/header-title';
import { NamedOptionSpec } from 'src/app/shared/option-spec-input';
import { extractErrorMessage } from 'src/app/utils';
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
  private destroy$ = new Subject();

  editMode = false;

  name: string = '';
  fullname = '';
  emailAddresses: string[] = [''];
  phoneNumbers: string[] = [''];
  password = '';
  preview = '';
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
      this.identityapi.getUser(this.name).subscribe({
        next: (user) => {
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

    this.identityapi
      .editUser(this.getProfile())
      .pipe(switchMap(() => updatePermissions))
      .subscribe({
        next: () => {
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
