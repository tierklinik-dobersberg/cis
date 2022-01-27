import { ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from "@angular/core";
import { ChartConfiguration, ChartData } from "chart.js";
import { Observable, of, Subject } from "rxjs";
import { debounceTime, switchMap, takeUntil } from "rxjs/operators";
import { mergeDeep } from "src/app/utils";

export type TimeRange = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';

@Component({
    selector: 'tkd-time-chart', // eslint-disable-line
    templateUrl: './time-chart.html',
    styleUrls: ['./time-chart.scss']
})
export class TimeChartComponent implements OnDestroy, OnChanges, OnInit {
    private destroy$ = new Subject<void>();
    private reload$ = new Subject<{from: Date, to: Date}>();

    readonly _defaultOptions: ChartConfiguration['options'] = {
        responsive: true,
        maintainAspectRatio: false,
        // We use these empty structures as placeholders for dynamic theming.
        scales: {
            y: {
                beginAtZero: true,
                min: 0,
            },
            x: {
                type: 'time',
                time: {
                    unit: 'day',
                    round: 'day',
                    displayFormats: {
                        day: 'MMM D'
                    }
                },
            },
        },
        parsing: {
            xAxisKey: 'time',
            yAxisKey: 'value'
        },
        plugins: {
            legend: {
                display: true,
                position: 'bottom',
            },
        }
    };

    constructor(
        private cdr: ChangeDetectorRef,
    ) {}

    data: ChartData<any, any> = {datasets: []};

    @Input()
    title = '';

    @Input()
    description = '';

    @Input()
    timeRange: string = '';

    @Input()
    chartType: 'bar' | 'line' = 'line';

    @Input()
    set options(v: ChartConfiguration['options']) {
      this._options = mergeDeep(this._defaultOptions, v)
      console.log("options", this._options)
    }
    get options() {
      return this._options;
    }
    _options: ChartConfiguration['options'] = this._defaultOptions;

    @Input()
    from: Date | null = new Date(0, 0, 0);

    @Input()
    to: Date | null = new Date(2100, 1, 1);

    @Input()
    load: (from: Date, to: Date, timeRange?: string) => Observable<ChartData> = () => of();

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
        this.reload$.complete();
    }

    ngOnInit() {
        this.reload$
            .pipe(
                takeUntil(this.destroy$),
                debounceTime(5),
                switchMap(({from, to}) => this.load(from, to, this.timeRange)),
            )
            .subscribe(data => {
                this.data = data;
                this._options = mergeDeep(this._options, {
                  scales: {
                    x: {
                      time: {
                        unit: this.timeRange || 'day',
                        round: this.timeRange || 'day',
                      },
                      min: this.from.getTime(),
                      max: this.to.getTime(),
                    }
                  }
                })
                if (data.datasets.some(d => d.data.length > 256)) {
                  this._options = mergeDeep(this._options, {
                    elements: {
                      line: {
                        borderWidth: 1,
                      },
                      point: {
                        pointRadius: 0,
                      },
                    }
                  })
                } else {
                  this._options = mergeDeep(this._options, {
                    elements: {
                      line: {
                        borderWidth: 3,
                      },
                      point: {
                        pointRadius: 3,
                      },
                    }
                  })
                }
                console.log(this._options)
                this.cdr.detectChanges();
            })

        this.reload$.next({from: this.from, to: this.to})
    }

    ngOnChanges(changes: SimpleChanges) {
        if ('to' in changes || 'from' in changes || 'load' in changes || 'timeRange' in changes) {
            if (!!this.to && !!this.from && this.load) {
                this.reload$.next({from: this.from, to: this.to})
            }
        }
    }
}
