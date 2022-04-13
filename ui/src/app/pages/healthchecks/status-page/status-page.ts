import { ChangeDetectionStrategy, ChangeDetectorRef, Component, IterableDiffers, OnDestroy, OnInit, TrackByFunction } from "@angular/core";
import { ChartData } from "chart.js";
import { interval, map, Observable, startWith, Subject, switchMap, takeUntil } from "rxjs";
import { ConfigAPI, HealthchecksAPI, PingDefinition } from "src/app/api";
import { ColorService } from "src/app/shared/charts/color.service";
import { HeaderTitleService } from "src/app/shared/header-title";

interface LocalPingDef extends PingDefinition {
  _id: string;
  load: (from: Date, to: Date) => Observable<ChartData>;
}

@Component({
  templateUrl: './status-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  trackPing: TrackByFunction<LocalPingDef> = (_: number, ping: LocalPingDef) => ping.Name;

  pings: LocalPingDef[] = [];

  from = new Date(new Date().getTime() - 24*60*60*1000)
  to = new Date()
  loading = true;

  datasets: {
    [pingID: string]: any;
  } = {}

  constructor(
    private headerTitleService: HeaderTitleService,
    private configAPI: ConfigAPI,
    private healthcheckAPI: HealthchecksAPI,
    private cdr: ChangeDetectorRef,
    private differFactory: IterableDiffers,
    private colorService: ColorService,
  ) {}

  ngOnInit(): void {
    this.headerTitleService.set("Status", "Übersicht über den Systemstatus")

    const differ = this.differFactory.find([]).create<LocalPingDef>((_: number, ping: LocalPingDef) => {
      return `${ping.Name}-${ping.State}`
    })

    interval(2000)
      .pipe(
        startWith(-1),
        takeUntil(this.destroy$),
        switchMap(() => this.configAPI.getSettings("healthchecks")),
        map(result =>  Object.keys(result).map(key => {
          const instance = result[key];
          return {
            ...instance,
            _id: key,
            load: (from: Date, to: Date) => this.healthcheckAPI.getRecords(instance.Name, {from, to})
              .pipe(
                map(data => {
                  let result = {
                    datasets: [
                      {
                        label: instance.Description || '',
                        data: data.map(point => ({
                          value: point.fail ? 0 : 1,
                          time: point.createdAt,
                        } as any))
                      }
                    ]
                  }

                  this.colorService.colorizeDatasets(result.datasets)

                  return result;
                })
              )
          } as LocalPingDef;
        })),
      )
      .subscribe(result => {
        this.loading = false;

        const diffs = differ.diff(result)
        if (!!diffs) {
          diffs.forEachAddedItem(record => {
            this.pings.push(record.item);
          })
          diffs.forEachRemovedItem(record => {
            this.pings.splice(record.currentIndex, 1)
          })
          diffs.forEachIdentityChange(record => {
            this.pings[record.currentIndex].State = record.item.State;
            this.pings[record.currentIndex].LastPingReceived = record.item.LastPingReceived;
          })
        }

        this.pings = [...this.pings]

        this.cdr.markForCheck();
      })
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

}
