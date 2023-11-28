import { Timestamp } from '@bufbuild/protobuf';
import { ConnectError, Code } from '@bufbuild/connect';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from "@angular/core";
import { GetVacationCreditsLeftResponse, OffTimeType, UserVacationSum } from "@tkd/apis";
import { OFFTIME_SERVICE, WORKTIME_SERVICE } from "src/app/api/connect_clients";
import { ProfileService } from "src/app/services/profile.service";
import { LayoutService } from 'src/app/services';
import ClassicEditor from '@tkd/ckeditor-build';
import { Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';

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

  public readonly Editor = ClassicEditor;
  public readonly layout = inject(LayoutService).withAutoUpdate(this.cdr)

  vacation: UserVacationSum | null = null;

  description: string = '';
  offTimeType: 'auto' | 'vacation' | 'timeoff' = 'auto';
  showTime = false;
  dateRange: [Date, Date] | null = null;

  ngOnInit() {
    const endOfYear = new Date(new Date().getFullYear()+1, 0, 1, 0, 0, 0, -1)

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

  createRequest() {
    let [from, to] = this.dateRange;

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
