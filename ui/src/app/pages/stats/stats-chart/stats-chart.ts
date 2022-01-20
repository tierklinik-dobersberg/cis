import { ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from "@angular/core";
import { _getOptionScrollPosition } from "@angular/material/core";
import { ChartConfiguration, ChartData } from "chart.js";
import { Observable, of, Subject } from "rxjs";
import { debounceTime, switchMap, takeUntil } from "rxjs/operators";
import { mergeDeep } from "src/app/utils";

@Component({
    selector: 'tkd-stats-chart',
    templateUrl: './stats-chart.html',
    styleUrls: ['./stats-chart.scss']
})
export class StatsChartComponent implements OnDestroy, OnChanges, OnInit {
    readonly _defaultOptions: ChartConfiguration['options'] = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false,
                position: 'right',
            },
        }
    };

    private destroy$ = new Subject<void>();
    private reload$ = new Subject<{from: Date, to: Date}>();

    constructor(
        private cdr: ChangeDetectorRef,
    ) {}

    data: ChartData<any, any> = {datasets: []};

    @Input()
    title = '';

    @Input()
    description = '';

    @Input()
    chartType: 'bar' | 'line' | 'pie' = 'bar';

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
    load: () => Observable<ChartData> = () => of();

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
                switchMap(() => this.load()),
            )
            .subscribe(data => {
                this.data = data;
                this.cdr.detectChanges();
            })

        this.reload$.next()
    }

    ngOnChanges(changes: SimpleChanges) {
      if ('load' in changes) {
        this.reload$.next()
      }
    }
}
