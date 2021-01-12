import { Component, OnDestroy, OnInit, TrackByFunction } from "@angular/core";
import { interval, Subscription } from "rxjs";
import { mergeMap, startWith } from "rxjs/operators";
import { CallLog, CalllogAPI } from "src/app/api";

interface LocalCallLog extends CallLog {
    localDate: string;
}

@Component({
    templateUrl: './calllog.html',
    styleUrls: ['./calllog.scss'],
})
export class CallLogComponent implements OnInit, OnDestroy {
    private subscriptions = Subscription.EMPTY;

    logs: LocalCallLog[] = [];

    trackLog: TrackByFunction<CallLog> = (i: number, l: LocalCallLog) => {
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
                    this.logs = logs.map(l => ({
                        ...l,
                        localDate: new Date(l.date).toLocaleString(),
                    }));
                })

        this.subscriptions.add(sub);
    }

    ngOnDestroy() {
        this.subscriptions.unsubscribe();
    }
}