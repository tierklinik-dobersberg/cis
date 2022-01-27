import { ThisReceiver } from "@angular/compiler";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { ChartConfiguration } from "chart.js";
import { BaseChartDirective } from "ng2-charts";
import { forkJoin, of, Subject } from "rxjs";
import { catchError, debounceTime, repeatWhen, takeUntil } from "rxjs/operators";
import { StatsAPI } from "src/app/api";
import { ColorService } from "src/app/shared/charts/color.service";
import { HeaderTitleService } from "src/app/shared/header-title";
import { Counter } from "./counter";

@Component({
  templateUrl: './stats.component.html',
  styleUrls: ['./stats.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject();
  private reload$ = new Subject<void>();
  private debounce$ = new Subject<[Date, Date]>();

  @ViewChild(BaseChartDirective, { static: true })
  chart: BaseChartDirective = null;

  dateRange: [Date, Date] = [
    new Date(new Date().valueOf() - 1000 * 60 * 60 * 24 * 7),
    new Date(),
  ]

  readonly translateTimeRanges = {
    'hour': 'per Stunde',
    'day': 'per Tag',
    'week': 'per Woche',
    'month': 'per Monat',
  }
  readonly numberOfMs = {
    'hour': 60 * 1000,
    'day': 24 * 60 * 1000,
    'week': 7 * 24 * 60 * 1000,
    'month': 30 * 24 * 60 * 1000,
  }
  readonly timeRanges = Object.keys(this.translateTimeRanges)
  timeRange: string = 'day'

  setTimeRange(tr: string) {
    this.timeRange = tr;
  }

  /**
   * Statistics about new-customer records by source over time
   */
  newCustomerStats = (from: Date, to: Date, timeRange: string) => this.statsAPI.groupByOverTime('customer', 'createdat', 'customerSource', from, to, timeRange);

  /**
   * Distribution of customer records by source
   */
  sourceDistribution = () => this.statsAPI.groupBy('customer', 'customerSource')
    .pipe(repeatWhen(() => this.reload$));

  /**
   * Distribution of customer with allowed vaccination reminders
   */
  byVaccinationReminder = () => this.statsAPI.groupBy('customer', 'vaccinationReminder', '', {
    "true": "Impferinnerung: Ja",
    "": "Impferinnerung: Nein",
    "false": "Impferinnerung: Nein"
  })
    .pipe(repeatWhen(() => this.reload$));

  /**
   * Total call duration aggregated over time and grouped by customer source
   */
  callopts: ChartConfiguration['options'] = {
    scales: {
      y: {
        ticks: {
          callback: v => epoch_to_hh_mm_ss(v),
          stepSize: 30 * 60
        }
      }
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: function (context: any) {
            let label = context.dataset.label || '';

            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += epoch_to_hh_mm_ss(context.parsed.y);
            }
            return label;
          }
        }
      }
    }
  }
  calllogs = (from: Date, to: Date, timeRange: string) => this.statsAPI.groupByOverTime('calllogs', 'date', 'customerSource', from, to, timeRange, 'totalDuration')
    .pipe(repeatWhen(() => this.reload$));

  /**
   * Distinct callers over time
   */
  callers = (from: Date, to: Date, timeRange: string) => this.statsAPI.groupByOverTime('calllogs', 'date', 'callType', from, to, timeRange, '')
    .pipe(repeatWhen(() => this.reload$));

  counters: Counter[] = [];

  constructor(
    private headerService: HeaderTitleService,
    private statsAPI: StatsAPI,
    private cdr: ChangeDetectorRef,
    private colorService: ColorService,
  ) { }

  reload() {
    this.reload$.next();
    this.cdr.markForCheck();
  }

  newRange(event: [Date, Date]) {
    event[1] = new Date(event[1].valueOf() + 24 * 60 * 60 * 1000 - 1000);

    this.debounce$.next(event);
  }

  ngOnInit() {
    this.headerService.set('Statistiken', 'Hier findest du verschiedene Grafiken und Statistiken über wichtige KPIs.');

    this.debounce$
      .pipe(takeUntil(this.destroy$), debounceTime(1000))
      .subscribe(data => {
        let ms = data[1].getTime() - data[0].getTime();

        let newRange = 'hour';
        this.timeRanges.forEach(rangeKey => {
          if (ms / this.numberOfMs[rangeKey] > 256) {
            newRange = rangeKey;
          }
        })
        console.log(`new range is ${newRange}`)
        this.timeRange = newRange;
        this.dateRange = data;
        this.cdr.markForCheck();
      });

    forkJoin({
      total: this.statsAPI.count('customer', 'null')
        .pipe(catchError(() => of(0))),
      invalidNumbers: this.statsAPI.count('customer', 'invalidNumbers')
        .pipe(catchError(() => of(0))),
      cities: this.statsAPI.count('customer', 'distinctCities')
        .pipe(catchError(() => of(0))),
      totalPatients: this.statsAPI.count('patients', 'null')
        .pipe(catchError(() => of(0))),
    })
      .pipe(repeatWhen(() => this.reload$))
      .subscribe(numbers => {
        this.counters = [
          {
            title: 'Kundendatensätze',
            count: numbers.total,
            color: '',
          },
          {
            title: 'Ohne Telefonnummer',
            count: numbers.invalidNumbers,
            color: numbers.invalidNumbers > 0 ? 'rost-dust' : 'secondary',
          },
          {
            title: 'Ortschaften (nach PLZ)',
            count: numbers.cities,
            color: '',
          },
          {
            title: 'Patientendatensätze',
            count: numbers.totalPatients,
            color: '',
          }
        ]
        this.cdr.markForCheck();
      })
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

function epoch_to_hh_mm_ss(epoch) {
  return new Date(epoch * 1000).toISOString().substr(12, 7)
}
