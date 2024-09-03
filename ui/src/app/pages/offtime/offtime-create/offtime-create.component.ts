import { DatePipe, NgClass } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnInit, effect, inject, model, signal } from "@angular/core";
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
import { injectOfftimeService, injectWorktimeSerivce } from "@tierklinik-dobersberg/angular/connect";
import { HlmInputModule } from '@tierklinik-dobersberg/angular/input';
import { HlmLabelModule } from '@tierklinik-dobersberg/angular/label';
import { LayoutService } from "@tierklinik-dobersberg/angular/layout";
import { DurationPipe } from "@tierklinik-dobersberg/angular/pipes";
import { HlmSelectModule } from '@tierklinik-dobersberg/angular/select';
import { HlmSheetModule } from "@tierklinik-dobersberg/angular/sheet";
import { HlmTableModule } from "@tierklinik-dobersberg/angular/table";
import { GetVacationCreditsLeftResponse, OffTimeType, UserVacationSum } from "@tierklinik-dobersberg/apis/roster/v1";
import { endOfDay, startOfDay } from "date-fns";
import { MarkdownModule } from "ngx-markdown";
import { toast } from "ngx-sonner";
import { MyEditor } from 'src/app/ckeditor';
import { TkdDatePickerComponent } from "src/app/components/date-picker";
import { OffTimeCalendarOverviewComponent } from "../offtime-calendar-overview/calendar-overview";

const dateForDateTimeInputValue = date => new Date(date.getTime() + date.getTimezoneOffset() * -60 * 1000).toISOString().slice(0, 19);

@Component({
  templateUrl: './offtime-create.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    NgClass,
    FormsModule,
    OffTimeCalendarOverviewComponent,
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
    TkdDatePickerComponent,
    DatePipe,
    HlmTableModule,
    MarkdownModule
  ]
})
export class OffTimeCreateComponent implements OnInit {
  private readonly offTimeSerivce = injectOfftimeService();
  private readonly workTimeService = injectWorktimeSerivce();
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  public readonly Editor = MyEditor;
  public readonly layout = inject(LayoutService);

  protected readonly description = model('');
  protected readonly offTimeType = model<'auto' | 'vacation' | 'timeoff'>('auto');
  protected readonly showTime = model(false);

  protected readonly dateRange = model<[Date, Date]>([null, null])
  
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

  ngOnInit() {
    if (this.route.snapshot.queryParamMap.has("d")) {
      const d = new Date(this.route.snapshot.queryParamMap.get("d"))

      const from = startOfDay(d)
      const to = endOfDay(d)

      this.dateRange.set([from, to])
    }
  }

  createRequest() {
    const current = this.currentUser();
    const dateRange = this.dateRange();
    if (!dateRange || dateRange.length != 2) {
      toast.error('Start und Enddatum müssen angegeben werden');
      return
    }
    
    let [from, to] = dateRange;
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
