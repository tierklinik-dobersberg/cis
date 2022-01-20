import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { ChartConfiguration } from "chart.js";
import { BaseChartDirective } from "ng2-charts";
import { Subject } from "rxjs";
import { tap } from "rxjs/operators";
import { StatsAPI } from "src/app/api";
import { ColorService } from "src/app/shared/charts/color.service";
import { HeaderTitleService } from "src/app/shared/header-title";

@Component({
    templateUrl: './stats.component.html',
    styleUrls: ['./stats.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsPageComponent implements OnInit, OnDestroy {
    private destroy$ = new Subject();

    @ViewChild(BaseChartDirective, {static: true})
    chart: BaseChartDirective = null;

    dateRange: [Date, Date] = [
      new Date( new Date().valueOf() - 1000 * 60 * 60 * 24 * 7 ),
      new Date(),
    ]

    /**
     * Statistics about new-customer records by source over time
     */
    newCustomerStats = (from: Date, to: Date, timeRange: string) => this.statsAPI.groupByOverTime('customer', 'createdat', 'customerSource', from, to);

    /**
     * Distribution of customer records by source
     */
    sourceDistribution = () => this.statsAPI.groupBy('customer', 'customerSource')

    /**
     * Distribution of customer with allowed vaccination reminders
     */
    byVaccinationReminder = () => this.statsAPI.groupBy('customer', 'vaccinationReminder', '', {
      "true":  "Impferinnerung: Ja",
      "":      "Impferinnerung: Nein",
      "false": "Impferinnerung: Nein"
    })

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
            label: function(context: any) {
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
    calllogs = (from: Date, to: Date, timeRange: string) => this.statsAPI.groupByOverTime('calllogs', 'date', 'customerSource', from, to, 'totalDuration')

    /**
     * Distinct callers over time
     */
    callers = (from: Date, to: Date, timeRange: string) => this.statsAPI.groupByOverTime('calllogs', 'date', 'callType', from, to, '')

    constructor(
        private headerService: HeaderTitleService,
        private statsAPI: StatsAPI,
        private cdr: ChangeDetectorRef,
    ) {}

    reload() {
      this.dateRange = [...this.dateRange];
      this.cdr.markForCheck();
    }

    ngOnInit() {
        this.headerService.set('Statistiken', 'Hier findest du verschiedene Grafiken und Statistiken über wichtige KPIs.');
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }
}

function epoch_to_hh_mm_ss(epoch) {
  return new Date(epoch*1000).toISOString().substr(12, 7)
}
