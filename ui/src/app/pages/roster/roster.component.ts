import { of } from 'rxjs';
import { ConnectError, Code } from '@bufbuild/connect';
import { Timestamp } from '@bufbuild/protobuf';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from "@angular/core";
import { HOLIDAY_SERVICE, OFFTIME_SERVICE, ROSTER_SERVICE, WORKTIME_SERVICE } from "src/app/api/connect_clients";
import { AnalyzeWorkTimeResponse, FindOffTimeRequestsResponse, GetHolidayResponse, GetOffTimeCostsResponse, GetUserShiftsResponse, GetVacationCreditsLeftResponse, GetWorkTimeResponse, OffTimeCostSummary, OffTimeEntry, PlannedShift, PublicHoliday, UserVacationSum, WorkShift, WorkTime, WorkTimeAnalysis } from '@tkd/apis';
import { toDateString } from 'src/app/utils';
import { ProfileService } from 'src/app/services/profile.service';
import { HeaderTitleService } from 'src/app/shared/header-title';

interface LocalUserShift {
  from: Date;
  to: Date;
  today: boolean;
  dateStr: string;
  definition?: WorkShift;
  spansNextDay?: boolean;

  offtime?: OffTimeEntry;
  holiday?: PublicHoliday;
  shift?: PlannedShift;
}

@Component({
  templateUrl: './roster.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RosterComponent implements OnInit {
  private readonly rosterService = inject(ROSTER_SERVICE);
  private readonly crd = inject(ChangeDetectorRef)
  private readonly profileService = inject(ProfileService);
  private readonly headerTitle = inject(HeaderTitleService);
  private readonly holidayService = inject(HOLIDAY_SERVICE)
  private readonly offTimeService = inject(OFFTIME_SERVICE);
  private readonly workTimeService = inject(WORKTIME_SERVICE)

  userShifts: LocalUserShift[] | null = null;
  workTime: WorkTimeAnalysis | null = null;
  offTimeCosts: OffTimeCostSummary | null = null;
  vacation: UserVacationSum | null = null;
  currentWorkTime: WorkTime | null = null;

  readonly now = new Date();

  from =  new Date(this.now.getFullYear(), this.now.getMonth(), 1, 0, 0, 0, 0);
  to =  new Date(this.now.getFullYear(), this.now.getMonth() + 1, 1, 0, 0, 0, -1);

  ngOnInit() {
    const from = Timestamp.fromDate(this.from);
    const to = Timestamp.fromDate(this.to);

    this.headerTitle.set(
      'Deine Dienste',
      'Eine Übersicht über deine Dienste',
      undefined,
    )

    Promise.all([
      this.rosterService
        .getUserShifts({
          timerange: {
            from,
            to
          }
        })
        .catch(err => {
          if (ConnectError.from(err).code !== Code.NotFound) {
            console.error(err)
          }

          return new GetUserShiftsResponse()
        }),

      this.holidayService
        .getHoliday({
          month: BigInt(this.from.getMonth() + 1),
          year: BigInt(this.from.getFullYear()),
        })
        .catch(err => {
          if (ConnectError.from(err).code !== Code.NotFound) {
            console.error(err)
          }

          return new GetHolidayResponse()
        }),

      this.offTimeService
        .getOffTimeCosts({
          forUsers: {
            userIds: [this.profileService.snapshot.user.id]
          },
        })
        .catch(err => {
          if (ConnectError.from(err).code !== Code.NotFound) {
            console.error(err)
          }

          return new GetOffTimeCostsResponse()
        }),

      this.workTimeService
        .getVacationCreditsLeft({
          analyze: true,
          forUsers: {
            userIds: [this.profileService.snapshot.user.id],
          },
          until: Timestamp.fromDate(new Date(this.now.getFullYear(), 11, 1, 23, 59, 59)),
        })
        .catch(err => {
          if (ConnectError.from(err).code !== Code.NotFound) {
            console.error(err)
          }

          return new GetVacationCreditsLeftResponse()
        }),

      this.workTimeService
        .getWorkTime({
          userIds: [this.profileService.snapshot.user.id]
        })
        .catch(err => {
          if (ConnectError.from(err).code !== Code.NotFound) {
            console.error(err)
          }

          return new GetWorkTimeResponse();
        }),

      this.offTimeService
        .findOffTimeRequests({
          from: from,
          to: to,
          userIds: [this.profileService.snapshot.user.id],
          approved: true,
        })
        .catch(err => {
          if (ConnectError.from(err).code !== Code.NotFound) {
            console.error(err)
          }

          return new FindOffTimeRequestsResponse()
        })
    ])
      .then(([shifts, holidays, costs, vacation, worktime, offtime]) => {
        this.offTimeCosts = costs.results.find(entry => entry.userId === this.profileService.snapshot.user.id)?.summary || null;
        this.vacation = vacation.results.find(entry => entry.userId === this.profileService.snapshot.user.id) || null;
        this.currentWorkTime = worktime.results.find(entry => entry.userId === this.profileService.snapshot.user.id)?.current || null;

        const localShifts = shifts.shifts
          .map(plannedShift => {
            const from = plannedShift.from.toDate()
            const to = plannedShift.to.toDate();
            const fromDateString = toDateString(from);
            const holiday = holidays.holidays.find(day => day.date === fromDateString);

            return <LocalUserShift>{
              dateStr: fromDateString,
              today: fromDateString === toDateString(this.now),
              from,
              to,
              holiday,
              shift: plannedShift,
              definition: shifts.definitions.find(ws => ws.id === plannedShift.workShiftId)!,
              spansNextDay: toDateString(from) !== toDateString(to),
              offtime: undefined
            }
          });

        offtime.results
          .filter(entry => entry.requestorId === this.profileService.snapshot.user.id)
          .forEach(entry => {
            const fromDateStr = toDateString(entry.from.toDate())
            const toDateStr = toDateString(entry.to.toDate())
            const holiday = holidays.holidays.find(day => day.date === fromDateStr);

            localShifts.push({
              dateStr: fromDateStr,
              holiday,
              spansNextDay: fromDateStr !== toDateStr,
              today: false,
              from: entry.from.toDate(),
              to: entry.to.toDate(),
              offtime: entry,
            })
          })

        return localShifts
          .sort((a, b) => {
            let diff = a.from.valueOf() - b.from.valueOf();

            if (diff !== 0) {
              return diff
            }

            return a.to.valueOf() - b.to.valueOf()
          });
      })
      .then(shifts => {
        this.userShifts = shifts;
        this.crd.markForCheck();
      })
      .catch(err => console.error(err))

    this.rosterService
      .analyzeWorkTime({
        from: toDateString(this.from),
        to: toDateString(this.to),
        /*
        users: {
          userIds: [this.profileService.snapshot.user.id]
        },
        */
      })
      .catch(err => {
        console.error(err)
        return new AnalyzeWorkTimeResponse()
      })
      .then(response => {
        this.workTime = response.results.find(result => result.userId === this.profileService.snapshot.user.id) || null;
        this.crd.markForCheck();
      })
  }
}
