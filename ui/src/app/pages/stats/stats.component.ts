import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { Subject } from "rxjs";
import { CustomerAPI } from "src/app/api/customer.api";
import { HeaderTitleService } from "src/app/shared/header-title";
import { ChartConfiguration, ChartData, ChartType, ScatterDataPoint } from 'chart.js';
import { ColorService } from "src/app/shared/charts/color.service";
import { BaseChartDirective } from "ng2-charts";

@Component({
    templateUrl: './stats.component.html',
    styleUrls: ['./stats.component.scss'],
    //changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsPageComponent implements OnInit, OnDestroy, AfterViewInit {
    private destroy$ = new Subject();

    @ViewChild(BaseChartDirective, {static: true})
    chart: BaseChartDirective = null;

    newCustomerData: ChartData<'bar', any[]> = {
        datasets: []
    };
    newCustomerOptions: ChartConfiguration['options'] = {
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

    sourceDistData: ChartData<'pie'> = {
        datasets: []
    }
    sourceDistOptions: ChartConfiguration['options'] = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'right',
            },
        }
    }

    constructor(
        private headerService: HeaderTitleService,
        private customerapi: CustomerAPI,
        private colorService: ColorService,
        private cdr: ChangeDetectorRef
    ) {

    }

    ngOnInit() {
        this.headerService.set('Statistiken', 'Hier findest du verschiedene Grafiken und Statistiken über wichtige KPIs.');
    }

    ngAfterViewInit() {

        this.customerapi.newCustomerStats(new Date(0, 0, 0), new Date(2100, 1, 1))
            .subscribe(data => {
                this.colorService.colorizeDatasets(data);
                this.newCustomerData = {
                    datasets: data
                };
                this.cdr.detectChanges();
            });

        this.customerapi.customerSourceDistribution()
            .subscribe(data => {
                this.sourceDistData = data;
                this.cdr.markForCheck();
            })
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }
}
