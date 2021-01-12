import { Component, OnDestroy, OnInit, TrackByFunction } from "@angular/core";
import { interval, Subscription } from "rxjs";
import { mergeMap, startWith } from "rxjs/operators";
import { CallLog, CalllogAPI } from "src/app/api";

@Component({
    templateUrl: './calllog.html',
    styleUrls: ['./calllog.scss'],
})
export class CallLogComponent implements OnInit, OnDestroy {
    private subscriptions = Subscription.EMPTY;

    logs: CallLog[] = [];

    trackLog: TrackByFunction<CallLog> = (i: number, l: CallLog) => {
        if (!!l) {
            return l._id!;
        }

        return i;
    };

    constructor(private calllogapi: CalllogAPI) { }

    ngOnInit() {
        this.subscriptions = new Subscription();

        const sub =
            interval(5000)
                .pipe(
                    startWith(0),
                    mergeMap(() => {
                        const d = new Date();
                        const year = d.getFullYear();
                        const month = d.getMonth() + 1
                        const day = d.getDate();

                        return this.calllogapi.forDate(year, month, day);
                    })
                )
                .subscribe(logs => {
                    this.logs = logs;
                })

        this.subscriptions.add(sub);
    }

    ngOnDestroy() {
        this.subscriptions.unsubscribe();
    }
}