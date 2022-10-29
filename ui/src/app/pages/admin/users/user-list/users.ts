import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ProfileWithAvatar } from '@tkd/api';
import { NzMessageService } from 'ng-zorro-antd/message';
import { forkJoin, of, Subscription } from 'rxjs';
import { catchError, filter, startWith, switchMap } from 'rxjs/operators';
import {
  ConfigAPI,
  OptionSpec,
  UserProperty,
  UserService,
} from 'src/app/api';
import { Roster2Service } from 'src/app/api/roster2';
import { LayoutService } from 'src/app/services';
import { HeaderTitleService } from 'src/app/shared/header-title';
import { NamedOptionSpec } from 'src/app/shared/option-spec-input';
import { extractErrorMessage } from 'src/app/utils';
import { Duration } from 'src/utils/duration';

interface UserModel extends ProfileWithAvatar {
  timePerWeek: Duration
}

@Component({
  templateUrl: './users.html',
  styleUrls: ['./users.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserListComponent implements OnInit, OnDestroy {
  constructor(
    private header: HeaderTitleService,
    private userService: UserService,
    private configapi: ConfigAPI,
    private roster2: Roster2Service,
    private message: NzMessageService,
    public layout: LayoutService,
    private cdr: ChangeDetectorRef
  ) {}
  private subscription = Subscription.EMPTY;

  expandSet = new Set<string>();
  userProps: UserProperty[] = [];
  hasWorkTime = true;
  profiles: UserModel[] = [];

  onExpandChange(id: string, checked: boolean): void {
    if (checked) {
      this.expandSet.add(id);
    } else {
      this.expandSet.delete(id);
    }
  }

  ngOnInit(): void {
    this.subscription = new Subscription();

    this.header.set(
      'Benutzer Verwaltung',
      'Erstelle, bearbeite oder lösche Benutzerkonten.',
      null,
      [{ name: 'Administration', route: '/admin/' }]
    );

    this.subscription.add(
      this.configapi.change.pipe(filter((cfg) => !!cfg)).subscribe((cfg) => {
        this.userProps = (cfg.UserProperty || []).filter(
          (prop) => prop.Visibility === 'public'
        );
      })
    );

    this.subscription.add(
      this.userService.users
        .pipe(
          switchMap(profiles => forkJoin({
            profiles: of(profiles),
            workTimes: this.roster2.workTimes.current()
              .pipe(
                startWith({}),
                catchError(err => {
                  this.hasWorkTime = false;
                  this.message.error(extractErrorMessage(err, "Arbeitszeiten konnten nicht geladen werden"))
                  return of({})
                })
              )
          }))
        )
        .subscribe((result) => {
          this.profiles = result.profiles.map(user => {
            let timePerWeek = result.workTimes[user.name]?.timePerWeek || 0;

            return {
              timePerWeek: new Duration(timePerWeek),
              ...user,
            }
          });

          this.cdr.markForCheck();
        })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
