import { ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from "@angular/core";
import { ChartConfiguration, ChartData } from "chart.js";
import { Observable, of, Subject } from "rxjs";
import { debounceTime, switchMap, takeUntil } from "rxjs/operators";

export type TimeRange = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';

@Component({
    selector: 'tkd-time-chart',
    templateUrl: './time-chart.html',
    styleUrls: ['./time-chart.scss']
})
export class TimeChartComponent implements OnDestroy, OnChanges, OnInit {
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
    chartType: 'bar' | 'line' = 'line';

    @Input()
    options: ChartConfiguration['options'];

    @Input()
    from: Date | null = null;

    @Input()
    to: Date | null = null;

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
                switchMap(({from, to}) => this.load(from, to)),
            )
            .subscribe(data => {
                this.data = data;
                this.cdr.detectChanges();
            })
    }

    ngOnChanges(changes: SimpleChanges) {
        if ('to' in changes || 'from' in changes) {
            if (!!this.to && !!this.from) {
                this.reload$.next({from: this.from, to: this.to})
            }
        }
    }
}
