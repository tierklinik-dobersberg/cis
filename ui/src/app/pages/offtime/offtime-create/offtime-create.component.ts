import { NgClass } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, model, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from '@angular/router';
import { Timestamp } from '@bufbuild/protobuf';
import { CKEditorModule } from "@ckeditor/ckeditor5-angular";
import { Code, ConnectError } from '@connectrpc/connect';
import { BrnAlertDialogModule } from '@spartan-ng/ui-alertdialog-brain';
import { BrnSelectModule } from '@spartan-ng/ui-select-brain';
import { BrnSheetModule } from "@spartan-ng/ui-sheet-brain";
import { HlmAlertDialogModule } from "@tierklinik-dobersberg/angular/alertdialog";
import { injectCurrentProfile, injectUserProfiles } from "@tierklinik-dobersberg/angular/behaviors";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { HlmCheckboxModule } from '@tierklinik-dobersberg/angular/checkbox';
import { HlmInputModule } from '@tierklinik-dobersberg/angular/input';
import { HlmLabelModule } from '@tierklinik-dobersberg/angular/label';
import { LayoutService } from "@tierklinik-dobersberg/angular/layout";
import { DurationPipe } from "@tierklinik-dobersberg/angular/pipes";
import { HlmSelectModule } from '@tierklinik-dobersberg/angular/select';
import { HlmSheetModule } from "@tierklinik-dobersberg/angular/sheet";
import { GetVacationCreditsLeftResponse, OffTimeType, UserVacationSum } from "@tierklinik-dobersberg/apis";
import { CandyDate } from 'ng-zorro-antd/core/time';
import { NzDatePickerModule } from "ng-zorro-antd/date-picker";
import { NzSelectModule } from "ng-zorro-antd/select";
import { toast } from "ngx-sonner";
import { OFFTIME_SERVICE, WORKTIME_SERVICE } from "src/app/api/connect_clients";
import { MyEditor } from 'src/app/ckeditor';
import { toDateString } from 'src/app/utils';
import { OffTimeCalendarOverviewComponent } from "../offtime-calendar-overview/calendar-overview";

const dateForDateTimeInputValue = date => new Date(date.getTime() + date.getTimezoneOffset() * -60 * 1000).toISOString().slice(0, 19);

@Component({
  templateUrl: './offtime-create.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    NgClass,
    NzDatePickerModule,
    FormsModule,
    OffTimeCalendarOverviewComponent,
    NzSelectModule,
    CKEditorModule,
    DurationPipe,
    HlmInputModule,
    HlmButtonDirective,
    BrnSelectModule,
    HlmSelectModule,
    HlmLabelModule,
    HlmCheckboxModule,
    HlmAlertDialogModule,
    BrnAlertDialogModule,
    HlmSheetModule,
    BrnSheetModule,
  ]
})
export class OffTimeCreateComponent implements OnInit {
  private readonly offTimeSerivce = inject(OFFTIME_SERVICE);
  private readonly workTimeService = inject(WORKTIME_SERVICE);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  public readonly Editor = MyEditor;
  public readonly layout = inject(LayoutService);

  protected readonly description = model('');
  protected readonly offTimeType = model<'auto' | 'vacation' | 'timeoff'>('auto');
  protected readonly showTime = model(false);

  protected readonly _computedCandyDate = computed(() => {
    const from = this.from();
    
    if (from) {
      return new CandyDate(from);
    }
    
    return null
  })
  
  protected readonly _computedDateRange = computed(() => {
    const from = this.from();
    const to = this.to();
    
    if (!from || !to) {
      return null
    }
    
    return [
      new Date(from),
      new Date(to),
    ]
  })
  
  protected readonly _computedHoverValue = computed<[CandyDate, CandyDate]|null>(() => {
    const range = this._computedDateRange();
    if (!range) {
      return null
    }
    
    return [
      new CandyDate(range[0]),
      new CandyDate(range[1]),
    ]
  })
  
  protected readonly from = signal((new Date).toDateString());
  protected readonly to   = signal('');
  
  protected readonly profiles = injectUserProfiles();
  protected readonly currentUser = injectCurrentProfile();
  protected readonly vacation = signal<UserVacationSum | null>(null)
  
  // load user vacation credits once the profile is set
  private readonly _loadUserCreditsEffect = effect(() => {
    const current = this.currentUser();
    const endOfYear = new Date(new Date().getFullYear()+1, 0, 1, 0, 0, 0, -1)
    
    if (!current) {
      return;
    }

    this.workTimeService
      .getVacationCreditsLeft({
        forUsers: {
          userIds: [current.user.id]
        },
        until: Timestamp.fromDate(endOfYear),
      })
      .catch(err => {
        const cerr = ConnectError.from(err);
        if (cerr.code !== Code.NotFound) {
          toast.error('Resturlaub und ZA-Guthaben konnte nicht geladen werden', {
            description: cerr.message,
          })
        }

        return new GetVacationCreditsLeftResponse()
      })
      .then(response => {
        this.vacation.set(response.results.find(sum => sum.userId === current.user.id) || null);
      })
  })

  protected updateFromRangePicker(value: [Date, Date]) {
    if (value[0]) {
      this.from.set(
        this.showTime()
          ? dateForDateTimeInputValue(value[0])
          : toDateString(value[0])
      )
    }

    if (value[1]) {
      this.to.set(
        this.showTime()
          ? dateForDateTimeInputValue(value[1])
          : toDateString(value[1])
      )
    }
  }

  toggleShowTime() {
    this.showTime.set(!this.showTime());

    if (this.from()) {
      let from = new Date(this.from());

      if (this.showTime()) {
        from = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0)
      }

      this.from.set(this.showTime() ? dateForDateTimeInputValue(from) : toDateString(from));
    }

    if (this.to()) {
      let to = new Date(this.to());

      if (this.showTime()) {
        to = new Date(to.getFullYear(), to.getMonth(), to.getDate()+1, 0, 0, -1)
      }

      this.to.set(this.showTime() ? dateForDateTimeInputValue(to) : toDateString(to));
    }
  }

  ngOnInit() {
    if (this.route.snapshot.queryParamMap.has("d")) {
      const d = new Date(this.route.snapshot.queryParamMap.get("d"))

      const from = new CandyDate(d).setHms(0, 0, 0).nativeDate
      const to = new CandyDate(from).addDays(1).setHms(0, 0, -1).nativeDate

      this.from.set(from.toDateString());
      this.to.set(to.toDateString());
    }
  }

  createRequest() {
    const current = this.currentUser();
    const dateRange = this._computedDateRange();
    if (!dateRange || dateRange.length != 2) {
      toast.error('Start und Enddatum müssen angegeben werden');
      return
    }
    
    let [from, to] = dateRange;
    if (!this.showTime) {
      from = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0, 0)
      to = new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1, 0, 0, -1)
    }

    this.offTimeSerivce
      .createOffTimeRequest({
        description: this.description(),
        requestorId: current.user.id,
        from: Timestamp.fromDate(from),
        to: Timestamp.fromDate(to),
        requestType: (() => {
          switch (this.offTimeType()) {
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
        toast.success('Antrag wurde erfolgreich erstellt')
        this.router.navigate(['/offtime'])
      })
      .catch(err => {
        toast.error('Antrag konnte nicht erstellt werden', { description: ConnectError.from(err).message })
      })
  }
}
