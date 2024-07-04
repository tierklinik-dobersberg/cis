import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from "@angular/core";
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Timestamp } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import { GetVacationCreditsLeftResponse, OffTimeEntry, OffTimeType, Profile, UserVacationSum } from "@tierklinik-dobersberg/apis";
import { CandyDate } from 'ng-zorro-antd/core/time';
import { NzMessageService } from 'ng-zorro-antd/message';
import { UserService } from 'src/app/api';
import { OFFTIME_SERVICE, WORKTIME_SERVICE } from "src/app/api/connect_clients";
import { MyEditor } from 'src/app/ckeditor';
import { LayoutService } from 'src/app/services';
import { ProfileService } from "src/app/services/profile.service";
import { toDateString } from 'src/app/utils';

const dateForDateTimeInputValue = date => new Date(date.getTime() + date.getTimezoneOffset() * -60 * 1000).toISOString().slice(0, 19);

@Component({
  templateUrl: './offtime-create.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OffTimeCreateComponent implements OnInit {
  private readonly offTimeSerivce = inject(OFFTIME_SERVICE);
  private readonly workTimeService = inject(WORKTIME_SERVICE);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly profileService = inject(ProfileService);
  private readonly router = inject(Router);
  private readonly messageService = inject(NzMessageService)
  private readonly userService = inject(UserService)
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);

  public readonly Editor = MyEditor;
  public readonly layout = inject(LayoutService).withAutoUpdate(this.cdr)

  vacation: UserVacationSum | null = null;

  description: string = '';
  offTimeType: 'auto' | 'vacation' | 'timeoff' = 'auto';
  showTime = false;
  dateRange: [Date, Date] | null = null;

  existing: OffTimeEntry[] = [];
  profiles: Profile[] = [];

  calendarDate: CandyDate | null = null;

  from: string = '';
  to: string = '';

  toggleShowTime() {
    this.showTime = !this.showTime;

    if (this.from) {
      let from = new Date(this.from);

      if (this.showTime) {
        from = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0)
      }

      this.from = this.showTime ? dateForDateTimeInputValue(from) : toDateString(from);
    }

    if (this.to) {
      let to = new Date(this.to);

      if (this.showTime) {
        to = new Date(to.getFullYear(), to.getMonth(), to.getDate()+1, 0, 0, -1)
      }

      this.to = this.showTime ? dateForDateTimeInputValue(to) : toDateString(to);
    }

    this.updateDateRange('from');

    this.cdr.markForCheck();
  }

  ngOnInit() {
    if (this.route.snapshot.queryParamMap.has("d")) {
      const d = new Date(this.route.snapshot.queryParamMap.get("d"))

      const from = new CandyDate(d).setHms(0, 0, 0).nativeDate
      const to = new CandyDate(from).addDays(1).setHms(0, 0, -1).nativeDate

      this.dateRange = [from, to]

      this.updateDateRange('both')

    } else {
      this.calendarDate = new CandyDate();
    }

    const endOfYear = new Date(new Date().getFullYear()+1, 0, 1, 0, 0, 0, -1)

    this.userService
      .users
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(profiles => {
        this.profiles = profiles;
        this.cdr.markForCheck();
      })

    this.workTimeService
      .getVacationCreditsLeft({
        forUsers: {
          userIds: [this.profileService.snapshot.user.id]
        },
        until: Timestamp.fromDate(endOfYear),
      })
      .catch(err => {
        if (ConnectError.from(err).code !== Code.NotFound) {
          console.error(err);
        }

        return new GetVacationCreditsLeftResponse()
      })
      .then(response => {
        this.vacation = response.results.find(sum => sum.userId === this.profileService.snapshot.user.id) || null;

        this.cdr.markForCheck();
      })
  }

  get hoverValue(): any {
    if (this.dateRange) {
      return [ new CandyDate(this.dateRange[0]), new CandyDate(this.dateRange[1]) ]
    }

    return null;
  }

  updateDateRange(what: 'from' | 'to' | 'both') {
    if (what === 'both') {
      if (!this.dateRange || this.dateRange.length != 2) {
        return;
      }

      this.calendarDate = new CandyDate(this.dateRange[0]);

      return
    }

    if (this.from && this.to) {
      this.dateRange = [
        new Date(this.from),
        new Date(this.to),
      ]
    }
  }

  createRequest() {
    let dateRange = this.dateRange;
    let [from, to] = dateRange;

    if (!this.showTime) {
      from = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0, 0)
      to = new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1, 0, 0, -1)
    }

    this.offTimeSerivce
      .createOffTimeRequest({
        description: this.description,
        requestorId: this.profileService.snapshot.user.id,
        from: Timestamp.fromDate(from),
        to: Timestamp.fromDate(to),
        requestType: (() => {
          switch (this.offTimeType) {
            case 'auto':
              return OffTimeType.UNSPECIFIED
            case 'timeoff':
              return OffTimeType.TIME_OFF
            case 'vacation':
              return OffTimeType.VACATION
          }
        })(),
      })
      .then(() => {
        this.messageService.success('Antrag wurde erfolgreich erstellt')
        this.router.navigate(['/offtime'])
      })
      .catch(err => {
        this.messageService.error('Antrag konnte nicht erstellt werden: ' + ConnectError.from(err).rawMessage)
      })
  }
}
